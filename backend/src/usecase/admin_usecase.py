from datetime import datetime, timedelta, timezone
import logging
import secrets
import uuid

from sqlmodel import Session, select, update

from common.exceptions import BadRequestError, ConflictError, NotFoundError
from common.settings import settings
from dependencies.email import get_email_service
from interfaces.auth import AuthService
from models.appointment import Appointment, AppointmentStatus
from models.payment import Payment, PaymentStatus
from models.user import User, UserRole
from repo.appointment_repo import AppointmentRepo
from repo.payment_repo import PaymentRepo
from repo.psychologist_invitation_repo import PsychologistInvitationRepo
from repo.user_repo import UserRepository
from schemas.admin import (
    AdminRefundRequest,
    AdminUserClientProfileRead,
    AdminUserDetailRead,
    AdminUserPage,
    AdminUserPsychologistProfileRead,
    AdminUserRead,
    PsychologistInvitationCreate,
    PsychologistInvitationRead,
)
from schemas.psychologist import SocialMediaLink
from schemas.appointment import AppointmentRead
from services.email.base import BaseEmailService
from services.payments.base import PaymentProvider

logger = logging.getLogger("uvicorn.error")

INVITATION_EXPIRY_HOURS = 48


class AdminUsecase:

    def __init__(
        self,
        service: AuthService,
        db: Session,
        email_service: BaseEmailService | None = None,
    ):
        self.auth = service
        self.db = db
        self.user_repo = UserRepository(db)
        self.invitation_repo = PsychologistInvitationRepo(db)
        self.email_service = email_service or get_email_service()

    def list_users(
        self,
        role: UserRole | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> AdminUserPage:
        users, total = self.user_repo.list_users(role, search, page, page_size)

        return AdminUserPage(
            items=[self._read_user(user) for user in users],
            total=total,
            page=page,
            page_size=page_size,
        )

    def get_user_detail(self, user_id: uuid.UUID) -> AdminUserDetailRead:
        user = self.user_repo.get_by_id(user_id)
        if user is None:
            raise NotFoundError("User not found")

        base = self._read_user(user)
        psych_profile = self.user_repo.get_psychologist_profile(user.user_id)
        client_profiles = self.user_repo.list_client_profiles(user.user_id)

        psych_read = None
        if psych_profile is not None:
            links = [
                SocialMediaLink.model_validate(link)
                for link in (psych_profile.social_media_links or [])
            ]
            psych_read = AdminUserPsychologistProfileRead(
                full_name=psych_profile.full_name,
                license_number=psych_profile.license_number,
                specialization=psych_profile.specialization,
                bio=psych_profile.bio,
                social_media_links=links,
            )

        client_reads = [
            AdminUserClientProfileRead(
                profile_id=p.profile_id,
                profile_name=p.profile_name,
                relation_to_account_holder=(
                    p.relation_to_account_holder.value
                    if hasattr(p.relation_to_account_holder, "value")
                    else str(p.relation_to_account_holder)
                ),
                date_of_birth=p.date_of_birth,
                socmed_platform=p.socmed_platform,
                socmed_username=p.socmed_username,
            )
            for p in client_profiles
        ]

        return AdminUserDetailRead(
            **base.model_dump(),
            psychologist_profile=psych_read,
            client_profiles=client_reads,
        )

    def list_appointments(
        self, status: AppointmentStatus | None = None
    ) -> list[AppointmentRead]:
        stmt = select(Appointment)
        if status is not None:
            stmt = stmt.where(Appointment.status == status)
        appointments = self.db.exec(stmt).all()
        repo = AppointmentRepo(self.db)
        for appt in appointments:
            repo.expire_if_overdue(appt)
        if status is not None:
            appointments = [a for a in appointments if a.status == status]
        return repo.build_reads(appointments, include_internal=True)

    def confirm_manual_payment(
        self, appointment_id: uuid.UUID, note: str | None = None
    ) -> AppointmentRead:
        repo = AppointmentRepo(self.db)
        appt = repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        repo.expire_if_overdue(appt)
        if appt.status != AppointmentStatus.AWAITING_PAYMENT:
            raise BadRequestError(
                "Only appointments awaiting payment can be manually confirmed"
            )

        self.db.exec(
            update(Payment)
            .where(
                Payment.appointment_id == appointment_id,
                Payment.status == PaymentStatus.PENDING,
            )
            .values(status=PaymentStatus.FAILED)
        )
        self.db.add(
            Payment(
                appointment_id=appointment_id,
                amount=float(appt.price or 0.0),
                payment_method="manual",
                provider="manual",
                provider_ref=note,
                status=PaymentStatus.PAID,
                paid_at=datetime.now(timezone.utc),
            )
        )
        confirmed = repo.confirm(appt)

        client_email = repo.get_client_email(confirmed)
        if client_email:
            self.email_service.send_payment_confirmed(
                client_email,
                str(confirmed.appointment_id),
                "client",
            )
        psych_email = repo.get_psychologist_email(confirmed)
        if psych_email:
            self.email_service.send_payment_confirmed(
                psych_email,
                str(confirmed.appointment_id),
                "psychologist",
            )
        return repo.build_read(confirmed)

    def refund_appointment(
        self,
        appointment_id: uuid.UUID,
        payload: AdminRefundRequest,
        acting_admin_id: uuid.UUID,
        provider: PaymentProvider | None = None,
    ) -> AppointmentRead:
        repo = AppointmentRepo(self.db)
        appt = repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")

        if appt.status == AppointmentStatus.REFUNDED:
            raise BadRequestError("Appointment has already been fully refunded")

        payment_repo = PaymentRepo(self.db)
        session_payment = payment_repo.get_paid_session(appointment_id)
        if session_payment is None:
            raise BadRequestError("No paid session payment found for this appointment")
        if session_payment.status == PaymentStatus.PARTIALLY_REFUNDED:
            raise BadRequestError("Appointment has already been partially refunded")

        if payload.amount_centavos is not None and payload.percentage is not None:
            raise BadRequestError(
                "Provide either amount_centavos or percentage, not both"
            )

        paid_centavos = int(round(session_payment.amount * 100))
        if payload.amount_centavos is not None:
            refund_centavos = payload.amount_centavos
        elif payload.percentage is not None:
            refund_centavos = int(round(paid_centavos * (payload.percentage / 100.0)))
        else:
            raise BadRequestError(
                "Provide either amount_centavos or percentage for the refund"
            )

        if refund_centavos <= 0 or refund_centavos >= paid_centavos:
            raise BadRequestError(
                f"Partial refund amount must be strictly between 1 and {paid_centavos - 1} centavos"
            )

        refund_ref: str | None = None
        if (
            provider is not None
            and session_payment.provider == "paymongo"
            and hasattr(provider, "create_refund")
        ):
            if (
                not session_payment.gateway_payment_id
                and session_payment.provider_ref
                and hasattr(provider, "fetch_checkout_status")
            ):
                fetched = provider.fetch_checkout_status(session_payment.provider_ref)
                if fetched is not None and fetched.gateway_payment_id:
                    session_payment.gateway_payment_id = fetched.gateway_payment_id
                    self.db.add(session_payment)
                    self.db.commit()
                    self.db.refresh(session_payment)

            pay_id = session_payment.gateway_payment_id or session_payment.provider_ref
            if not pay_id:
                raise BadRequestError("Missing PayMongo payment ID for refund")
            refund_res = provider.create_refund(
                payment_id=pay_id,
                amount_centavos=refund_centavos,
                reason="requested_by_customer",
                notes=payload.reason,
            )
            refund_ref = refund_res.refund_id
        else:
            refund_ref = f"manual_refund_{uuid.uuid4().hex[:12]}"

        now = datetime.now(timezone.utc)
        payment_repo.mark_refunded(
            session_payment,
            status=PaymentStatus.PARTIALLY_REFUNDED,
            refund_amount_centavos=refund_centavos,
            refund_ref=refund_ref,
            refund_reason=payload.reason,
            refunded_at=now,
        )
        repo.release_selected_slot(appt)
        appt.scheduling_turn = None
        appt.payment_deadline = None
        appt.status = AppointmentStatus.PARTIALLY_REFUNDED
        appt.refund_amount_centavos = refund_centavos
        appt.refund_reason = payload.reason
        appt.refunded_at = now
        appt.refunded_by = acting_admin_id
        self.db.add(appt)
        self.db.commit()
        self.db.refresh(appt)
        logger.info(
            "Admin %s partially refunded appointment %s (%d centavos, ref=%s, reason=%s)",
            acting_admin_id,
            appointment_id,
            refund_centavos,
            refund_ref,
            payload.reason,
        )
        client_email = repo.get_client_email(appt)
        if client_email:
            self.email_service.send_refund_issued(
                client_email,
                str(appt.appointment_id),
                "client",
                amount_centavos=refund_centavos,
                is_full=False,
                reason=payload.reason,
            )
        psych_email = repo.get_psychologist_email(appt)
        if psych_email:
            self.email_service.send_refund_issued(
                psych_email,
                str(appt.appointment_id),
                "psychologist",
                amount_centavos=refund_centavos,
                is_full=False,
                reason=payload.reason,
            )
        return repo.build_read(appt, include_internal=True)

    def invite_psychologist(
        self,
        payload: PsychologistInvitationCreate,
        acting_admin_id: uuid.UUID,
    ) -> PsychologistInvitationRead:
        email = str(payload.email).strip().lower()

        if self.user_repo.get_by_email(email) is not None:
            raise ConflictError("An account with this email is already registered")
        if self.auth.get_username_by_email(email) is not None:
            raise ConflictError("An account with this email is already registered")

        now = datetime.now(timezone.utc)
        self.invitation_repo.revoke_pending_for_email(email, revoked_at=now)

        raw_token = secrets.token_urlsafe(32)
        expires_at = now + timedelta(hours=INVITATION_EXPIRY_HOURS)
        invitation = self.invitation_repo.create(
            email=email,
            raw_token=raw_token,
            invited_by=acting_admin_id,
            expires_at=expires_at,
        )

        base_url = (
            settings.FRONTEND_BASE_URL or settings.FRONTEND_URL
        ).rstrip("/")
        invitation_url = f"{base_url}/register/psychologist?token={raw_token}"

        self.email_service.send_psychologist_invitation(
            to=email,
            invitation_url=invitation_url,
            expires_hours=INVITATION_EXPIRY_HOURS,
        )

        return PsychologistInvitationRead(
            invitation_id=invitation.invitation_id,
            email=invitation.email,
            invitation_url=invitation_url,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
        )

    def _resolve_username(self, user: User) -> str | None:
        try:
            return (
                self.auth.get_username_by_sub(user.cognito_sub)
                or self.auth.get_username_by_email(user.email)
            )
        except Exception:
            logger.warning(
                "Could not resolve Cognito username for user %s", user.user_id
            )
            return None

    def _read_user(self, user: User) -> AdminUserRead:
        psych_profile = self.user_repo.get_psychologist_profile(user.user_id)
        admin_profile = self.user_repo.get_admin_profile(user.user_id)

        full_name = None
        if user.role == UserRole.ADMIN.value and admin_profile is not None:
            full_name = admin_profile.full_name
        elif user.role == UserRole.PSYCHOLOGIST.value and psych_profile is not None:
            full_name = psych_profile.full_name
        elif psych_profile is not None:
            full_name = psych_profile.full_name
        elif admin_profile is not None:
            full_name = admin_profile.full_name

        return AdminUserRead(
            user_id=user.user_id,
            email=user.email,
            username=self._resolve_username(user),
            role=UserRole(user.role),
            full_name=full_name,
            created_at=user.created_at,
        )
