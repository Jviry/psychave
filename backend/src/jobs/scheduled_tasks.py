"""Scheduled background tasks for payment expiry, SLA alerts, and session reminders."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from sqlmodel import Session, select

from common.database import engine
from common.time import now_manila
from dependencies.email import get_email_service
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from models.user import User, UserRole
from repo.appointment_repo import AppointmentRepo
from services.email.base import BaseEmailService
from utils.scheduling import slot_start


def run_scheduled_tasks(
    db: Session,
    email_service: BaseEmailService | None = None,
) -> dict[str, int]:
    """Run periodic booking maintenance tasks. Safe to invoke every 15 minutes."""
    emailer = email_service or get_email_service()
    repo = AppointmentRepo(db)
    now_local = now_manila()
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)

    expired_count = 0
    sla_alert_count = 0
    reminder_count = 0

    # 1. Payment deadline expiry -> transition to AWAITING_SCHEDULE and notify client
    awaiting_payment = db.exec(
        select(Appointment).where(
            Appointment.status == AppointmentStatus.AWAITING_PAYMENT,
            Appointment.payment_deadline.is_not(None),
        )
    ).all()
    for appt in awaiting_payment:
        if repo.expire_if_overdue(appt):
            expired_count += 1
            client_email = repo.get_client_email(appt)
            if client_email:
                emailer.send_payment_expired(client_email, str(appt.appointment_id))

    # 2. 24h (psychologists) / 48h (admins) pending pickup SLA alerts
    pending = db.exec(
        select(Appointment).where(
            Appointment.status == AppointmentStatus.PENDING,
            Appointment.requested_datetime.is_not(None),
        )
    ).all()
    psych_emails: list[str] | None = None
    admin_emails: list[str] | None = None
    for appt in pending:
        created = appt.requested_datetime
        if created is None:
            continue
        if created.tzinfo is not None:
            created = created.astimezone(timezone.utc).replace(tzinfo=None)
        age = now_utc - created
        alert_hours: int | None = None
        if age >= timedelta(hours=48) and appt.sla_48h_alerted_at is None:
            alert_hours = 48
            appt.sla_48h_alerted_at = now_utc
            appt.sla_24h_alerted_at = appt.sla_24h_alerted_at or now_utc
        elif (
            timedelta(hours=24) <= age < timedelta(hours=48)
            and appt.sla_24h_alerted_at is None
        ):
            alert_hours = 24
            appt.sla_24h_alerted_at = now_utc

        if alert_hours == 24:
            db.add(appt)
            if psych_emails is None:
                psych_emails = [
                    u.email
                    for u in db.exec(
                        select(User).where(User.role == UserRole.PSYCHOLOGIST.value)
                    ).all()
                    if u.email
                ]
            for psych_email in psych_emails:
                emailer.send_pending_sla_alert(
                    psych_email, str(appt.appointment_id), 24
                )
            sla_alert_count += 1
        elif alert_hours == 48:
            db.add(appt)
            if admin_emails is None:
                admin_emails = [
                    u.email
                    for u in db.exec(
                        select(User).where(User.role == UserRole.ADMIN.value)
                    ).all()
                    if u.email
                ]
            for admin_email in admin_emails:
                emailer.send_pending_sla_alert(
                    admin_email, str(appt.appointment_id), 48
                )
            sla_alert_count += 1

    # 3. 24h and 1h session reminders for confirmed sessions
    confirmed = db.exec(
        select(Appointment).where(
            Appointment.status == AppointmentStatus.CONFIRMED,
            Appointment.selected_slot_id.is_not(None),
        )
    ).all()
    for appt in confirmed:
        if appt.selected_slot_id is None:
            continue
        slot = db.get(ProposedSlot, appt.selected_slot_id)
        if slot is None:
            continue
        start = slot_start(slot.session_date, slot.start_time)
        delta = start - now_local
        if delta <= timedelta(0):
            continue

        hours_before: int | None = None
        if delta <= timedelta(hours=1) and appt.reminder_1h_sent_at is None:
            hours_before = 1
            appt.reminder_1h_sent_at = now_utc
        elif (
            timedelta(hours=1) < delta <= timedelta(hours=24)
            and appt.reminder_24h_sent_at is None
        ):
            hours_before = 24
            appt.reminder_24h_sent_at = now_utc

        if hours_before is not None:
            db.add(appt)
            slot_tuple = (slot.session_date, slot.start_time, slot.end_time)
            client_email = repo.get_client_email(appt)
            if client_email:
                emailer.send_session_reminder(
                    client_email,
                    str(appt.appointment_id),
                    slot_tuple,
                    hours_before,
                    meeting_link=appt.meeting_link,
                    recipient="client",
                )
            psych_email = repo.get_psychologist_email(appt)
            if psych_email:
                emailer.send_session_reminder(
                    psych_email,
                    str(appt.appointment_id),
                    slot_tuple,
                    hours_before,
                    meeting_link=appt.meeting_link,
                    recipient="psychologist",
                )
            reminder_count += 1

    db.commit()
    return {
        "expired_payments": expired_count,
        "sla_alerts": sla_alert_count,
        "reminders_sent": reminder_count,
    }


def handler(event, context):  # pragma: no cover - AWS Lambda entrypoint
    with Session(engine) as db:
        return run_scheduled_tasks(db)
