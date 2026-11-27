from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import MagicMock

import httpx
import pytest

from common.exceptions import BadRequestError, ConflictError
from common.settings import settings
from interfaces.auth import SignUpResult
from models.psychologist_invitation import PsychologistInvitation
from models.user import User, UserRole
from repo.psychologist_invitation_repo import hash_invitation_token
from schemas.admin import PsychologistInvitationCreate
from schemas.auth_model import PsychologistInviteRegisterRequest
from schemas.psychologist import SocialMediaLink
from services.brevo.brevo_service import BrevoService
from usecase.admin_usecase import AdminUsecase
from usecase.auth_usecase import AuthUsecase


class TestAdminPsychologistInvitation:
    def test_invite_psychologist_creates_token_revokes_prior_and_sends_email(
        self, monkeypatch
    ):
        auth = MagicMock()
        auth.get_username_by_email.return_value = None
        db = MagicMock()
        email_service = MagicMock()

        uc = AdminUsecase(auth, db, email_service=email_service)
        uc.user_repo = MagicMock()
        uc.user_repo.get_by_email.return_value = None
        uc.invitation_repo = MagicMock()

        created_row = PsychologistInvitation(
            invitation_id=uuid.uuid4(),
            email="dr.santos@example.com",
            token_hash="hashed",
            invited_by=uuid.uuid4(),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
        uc.invitation_repo.create.return_value = created_row

        res = uc.invite_psychologist(
            PsychologistInvitationCreate(email="Dr.Santos@example.com"),
            acting_admin_id=created_row.invited_by,
        )

        uc.invitation_repo.revoke_pending_for_email.assert_called_once()
        uc.invitation_repo.create.assert_called_once()
        email_service.send_psychologist_invitation.assert_called_once()
        assert res.email == "dr.santos@example.com"
        assert "/register/psychologist?token=" in res.invitation_url

    def test_invite_psychologist_rejects_already_registered_email(self):
        auth = MagicMock()
        db = MagicMock()
        email_service = MagicMock()
        uc = AdminUsecase(auth, db, email_service=email_service)
        uc.user_repo = MagicMock()
        uc.user_repo.get_by_email.return_value = User(
            user_id=uuid.uuid4(),
            cognito_sub="sub-1",
            email="existing@example.com",
            role=UserRole.CLIENT.value,
        )

        with pytest.raises(ConflictError, match="already registered"):
            uc.invite_psychologist(
                PsychologistInvitationCreate(email="existing@example.com"),
                acting_admin_id=uuid.uuid4(),
            )


class TestPsychologistInviteRegistration:
    def _build_invitation(
        self,
        raw_token: str = "valid_raw_token_123",
        *,
        used_at: datetime | None = None,
        revoked_at: datetime | None = None,
        expires_delta: timedelta = timedelta(hours=48),
    ) -> PsychologistInvitation:
        return PsychologistInvitation(
            invitation_id=uuid.uuid4(),
            email="dr.santos@example.com",
            token_hash=hash_invitation_token(raw_token),
            invited_by=uuid.uuid4(),
            expires_at=datetime.now(timezone.utc) + expires_delta,
            used_at=used_at,
            revoked_at=revoked_at,
        )

    def test_verify_psychologist_invitation_returns_email(self):
        auth = MagicMock()
        db = MagicMock()
        uc = AuthUsecase(auth, db)
        uc.invitation_repo = MagicMock()
        uc.invitation_repo.get_by_raw_token.return_value = (
            self._build_invitation()
        )

        res = uc.verify_psychologist_invitation("valid_raw_token_123")
        assert res.email == "dr.santos@example.com"

    def test_verify_psychologist_invitation_rejects_expired_or_used(self):
        auth = MagicMock()
        db = MagicMock()
        uc = AuthUsecase(auth, db)
        uc.invitation_repo = MagicMock()

        uc.invitation_repo.get_by_raw_token.return_value = (
            self._build_invitation(expires_delta=timedelta(hours=-1))
        )
        with pytest.raises(BadRequestError, match="expired"):
            uc.verify_psychologist_invitation("valid_raw_token_123")

        uc.invitation_repo.get_by_raw_token.return_value = (
            self._build_invitation(used_at=datetime.now(timezone.utc))
        )
        with pytest.raises(BadRequestError, match="already been used"):
            uc.verify_psychologist_invitation("valid_raw_token_123")

    def test_register_invited_psychologist_creates_cognito_user_and_profile(
        self,
    ):
        auth = MagicMock()
        auth.create_confirmed_user.return_value = SignUpResult(
            user_sub="sub-psych-001", is_confirmed=True
        )
        db = MagicMock()
        uc = AuthUsecase(auth, db)
        uc.invitation_repo = MagicMock()
        invitation = self._build_invitation()
        uc.invitation_repo.get_by_raw_token.return_value = invitation

        uc.user_repo = MagicMock()
        uc.user_repo.get_by_email.return_value = None
        uc.user_repo.get_by_sub.return_value = None
        created_user = User(
            user_id=uuid.uuid4(),
            cognito_sub="sub-psych-001",
            email="dr.santos@example.com",
            role=UserRole.PSYCHOLOGIST.value,
        )
        uc.user_repo.create.return_value = created_user
        uc.user_repo.get_psychologist_profile.return_value = None

        payload = PsychologistInviteRegisterRequest(
            token="valid_raw_token_123",
            username="dr_santos",
            password="StrongPassword1!",
            full_name="Dr. Maria Santos, RPsy",
            license_number="PRC-RPSY-2024-001",
            specialization="Trauma-Informed CBT",
            bio="Licensed psychologist specializing in trauma and anxiety.",
            social_media_links=[
                SocialMediaLink(
                    platform="Facebook",
                    url="https://facebook.com/dr.maria.santos",
                )
            ],
        )

        res = uc.register_invited_psychologist(payload)
        assert "Psychologist account created" in res["message"]
        auth.create_confirmed_user.assert_called_once_with(
            username="dr_santos",
            email="dr.santos@example.com",
            password="StrongPassword1!",
        )
        auth.add_user_to_group.assert_called_once_with(
            "dr_santos", UserRole.PSYCHOLOGIST.value
        )
        uc.invitation_repo.mark_used.assert_called_once_with(invitation)
        db.add.assert_called_once()
        db.commit.assert_called_once()


class TestBrevoPsychologistInvitationDelivery:
    def test_invite_psychologist_dispatches_via_brevo_with_env_settings(
        self, monkeypatch
    ):
        monkeypatch.setattr(settings, "EMAIL_FROM_NAME", "PsychAvenuePH")
        monkeypatch.setattr(settings, "EMAIL_FROM_EMAIL", "psychave.dev@gmail.com")
        monkeypatch.setattr(settings, "EMAIL_REPLY_TO", "")
        monkeypatch.setattr(settings, "BREVO_API_KEY", "xkeysib-test-key")
        monkeypatch.setattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000")

        posted: list[dict] = []

        def fake_post(url, *, headers, json, timeout):
            posted.append(
                {"url": url, "headers": headers, "json": json, "timeout": timeout}
            )
            req = httpx.Request("POST", url)
            return httpx.Response(201, request=req, json={"messageId": "<msg-1>"})

        monkeypatch.setattr(httpx, "post", fake_post)

        auth = MagicMock()
        auth.get_username_by_email.return_value = None
        db = MagicMock()

        uc = AdminUsecase(auth, db)
        assert isinstance(uc.email_service, BrevoService)
        uc.user_repo = MagicMock()
        uc.user_repo.get_by_email.return_value = None
        uc.invitation_repo = MagicMock()

        acting_admin_id = uuid.uuid4()
        uc.invitation_repo.create.return_value = PsychologistInvitation(
            invitation_id=uuid.uuid4(),
            email="dr.santos@example.com",
            token_hash="hashed",
            invited_by=acting_admin_id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )

        res = uc.invite_psychologist(
            PsychologistInvitationCreate(email="dr.santos@example.com"),
            acting_admin_id=acting_admin_id,
        )

        assert len(posted) == 1
        call = posted[0]
        assert call["url"] == "https://api.brevo.com/v3/smtp/email"
        assert call["headers"]["api-key"] == "xkeysib-test-key"
        assert call["json"]["sender"] == {
            "email": "psychave.dev@gmail.com",
            "name": "PsychAvenuePH",
        }
        assert call["json"]["to"] == [{"email": "dr.santos@example.com"}]
        assert "replyTo" not in call["json"]
        assert res.invitation_url in call["json"]["htmlContent"]
        assert res.invitation_url in call["json"]["textContent"]

    def test_brevo_skips_when_api_key_or_from_email_unset(self, monkeypatch):
        monkeypatch.setattr(settings, "EMAIL_FROM_EMAIL", "")
        monkeypatch.setattr(settings, "BREVO_API_KEY", "")

        called = False

        def fail_post(*args, **kwargs):
            nonlocal called
            called = True
            raise AssertionError("httpx.post should not be called")

        monkeypatch.setattr(httpx, "post", fail_post)

        svc = BrevoService()
        svc.send_psychologist_invitation(
            to="dr.santos@example.com",
            invitation_url="http://localhost:3000/register/psychologist?token=abc",
        )
        assert called is False

    def test_brevo_logs_and_does_not_raise_on_http_error(self, monkeypatch, caplog):
        monkeypatch.setattr(settings, "EMAIL_FROM_NAME", "PsychAvenuePH")
        monkeypatch.setattr(settings, "EMAIL_FROM_EMAIL", "psychave.dev@gmail.com")
        monkeypatch.setattr(settings, "EMAIL_REPLY_TO", "support@example.com")
        monkeypatch.setattr(settings, "BREVO_API_KEY", "xkeysib-bad-key")

        def error_post(url, *, headers, json, timeout):
            req = httpx.Request("POST", url)
            return httpx.Response(
                401, request=req, json={"code": "unauthorized", "message": "Key not found"}
            )

        monkeypatch.setattr(httpx, "post", error_post)

        svc = BrevoService()
        with caplog.at_level("ERROR"):
            svc.send_psychologist_invitation(
                to="dr.santos@example.com",
                invitation_url="http://localhost:3000/register/psychologist?token=abc",
            )

        assert "401" in caplog.text
        assert "Key not found" in caplog.text
