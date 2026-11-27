import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from common.exceptions import (
    BadRequestError,
    ConflictError,
    RateLimitError,
    UnauthenticatedError,
    UserNotConfirmedError,
    ValidationError,
)
from common.rate_limit import verification_rate_limiter
from models.admin_profile import AdminProfile
from models.client_profile import ClientProfile
from models.forms import Forms
from models.profile import Profile, ProfileRelation
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from pydantic import ValidationError as PydanticValidationError
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)
from schemas.profile import ProfileCreate, ProfileWithConsentCreate
from services.auth.fake_service import FakeAuthService
from usecase.auth_usecase import AuthUsecase
from usecase.profile_usecase import ProfileUsecase


def _valid_profile_payload(
    profile_name: str = "John Doe",
    dob: str = "1994-08-12",
    relation: str = "self",
) -> dict:
    return {
        "relation_to_account_holder": relation,
        "profile_name": profile_name,
        "date_of_birth": dob,
        "nationality": "Filipino",
        "permanent_address": "Block 1 Lot 2, Makati City",
        "present_address": "Unit 12B, Taguig City",
        "contact_number": "+639171234567",
        "preferred_contact_mode": "email",
        "emergency_contact_name": "Jane Doe",
        "emergency_contact_relation": "Spouse",
        "emergency_contact_number": "+639187654321",
    }


def _valid_consent_payload(
    signer_relation: str = "self",
    version: str = "v2",
) -> dict:
    return {
        "consent_version": version,
        "terms_agreed": True,
        "terms_signer_relation": signer_relation,
        "scope_acknowledged": True,
        "information_confirmed": True,
        "is_overseas_or_foreign": False,
        "overseas_acknowledged": False,
    }


def _make_user_create(
    username: str,
    email: str,
    password: str = "Password123!",
    dob: str = "1994-08-12",
    relation: str = "self",
    signer_relation: str = "self",
) -> UserCreate:
    return UserCreate(
        username=username,
        email=email,
        password=password,
        profile=_valid_profile_payload(dob=dob, relation=relation),
        consent=_valid_consent_payload(signer_relation=signer_relation),
    )


@pytest.fixture(autouse=True)
def clear_rate_limiter():
    verification_rate_limiter.clear_all()
    yield
    verification_rate_limiter.clear_all()


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture
def fake_auth():
    return FakeAuthService()


@pytest.fixture
def auth_usecase(fake_auth, session):
    return AuthUsecase(service=fake_auth, db=session)


def test_create_user_client_success(auth_usecase, fake_auth, session):
    creds = _make_user_create(username="johndoe", email="john@example.com")
    res = auth_usecase.create_user(creds)
    assert res == {"message": "register successful, check email for code"}

    # verify user, client profile, self profile, and consent form exist in db
    user = session.exec(select(User).where(User.email == "john@example.com")).first()
    assert user is not None
    assert user.role == UserRole.CLIENT.value
    assert session.get(ClientProfile, user.user_id) is not None

    profiles = session.exec(
        select(Profile).where(Profile.client_id == user.user_id)
    ).all()
    assert len(profiles) == 1
    assert profiles[0].relation_to_account_holder == ProfileRelation.self_
    assert profiles[0].profile_name == "John Doe"

    form = session.exec(
        select(Forms).where(Forms.profile_id == profiles[0].profile_id)
    ).first()
    assert form is not None
    assert form.terms_signer_relation == "self"

    # verify group added in auth service
    assert fake_auth.list_user_groups("johndoe") == ["client"]


def test_create_user_rejects_minor_or_non_self():
    with pytest.raises(PydanticValidationError):
        _make_user_create(
            username="minoruser",
            email="minor@example.com",
            dob="2015-05-01",
        )

    with pytest.raises(PydanticValidationError):
        _make_user_create(
            username="dependentuser",
            email="dep@example.com",
            relation="child",
        )


def test_create_user_always_creates_client_role(auth_usecase, session):
    creds = _make_user_create(username="admin1", email="admin@example.com")
    auth_usecase.create_user(creds)
    user = session.exec(select(User).where(User.email == "admin@example.com")).first()
    assert user is not None
    assert user.role == UserRole.CLIENT.value


def test_login_and_refresh_token(auth_usecase, fake_auth):
    creds = _make_user_create(username="testlogin", email="testlogin@example.com")
    auth_usecase.create_user(creds)
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="testlogin", confirmation_code="123456")
    )

    login_creds = UserLogin(username="testlogin", password="Password123!")
    tokens = auth_usecase.login_user(login_creds)

    assert tokens.access_token is not None
    assert tokens.id_token is not None
    assert tokens.refresh_token is not None

    # Test refresh
    refreshed = auth_usecase.refresh_access_token(tokens.refresh_token)
    assert refreshed.access_token is not None


def test_confirm_user_and_sync(auth_usecase, fake_auth, session):
    creds = _make_user_create(username="confirmuser", email="confirm@example.com")
    fake_auth.create_user(creds)
    fake_auth.add_user_to_group("confirmuser", "client")

    auth_usecase.confirm_user(
        ConfirmUserRequest(username="confirmuser", confirmation_code="123456")
    )

    user = session.exec(select(User).where(User.email == "confirm@example.com")).first()
    assert user is not None
    assert session.get(ClientProfile, user.user_id) is not None


def test_forgot_password_flow(auth_usecase, fake_auth):
    creds = _make_user_create(
        username="forgotuser",
        email="forgot@example.com",
        password="OldPassword123!",
    )
    auth_usecase.create_user(creds)
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="forgotuser", confirmation_code="123456")
    )

    res1 = auth_usecase.request_forgot_password("forgotuser")
    assert res1 == {"message": "confirmation code sent to email"}

    res2 = auth_usecase.confirm_forgot_password(
        ForgotPasswordConfirm(
            username="forgotuser",
            confirmation_code="654321",
            new_password="NewPassword123!",
        )
    )
    assert res2 == {"message": "password change successful"}

    # Should be able to login with new password
    tokens = auth_usecase.login_user(
        UserLogin(username="forgotuser", password="NewPassword123!")
    )
    assert tokens.access_token is not None


def test_logout(auth_usecase, fake_auth):
    creds = _make_user_create(username="logoutuser", email="logout@example.com")
    auth_usecase.create_user(creds)
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="logoutuser", confirmation_code="123456")
    )

    tokens = auth_usecase.login_user(
        UserLogin(username="logoutuser", password="Password123!")
    )
    logout_res = auth_usecase.logout_user(tokens.access_token)
    assert logout_res == {"message": "logout successful"}


def test_delete_user(auth_usecase, fake_auth):
    creds = _make_user_create(username="deleteuser", email="delete@example.com")
    auth_usecase.create_user(creds)
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="deleteuser", confirmation_code="123456")
    )

    tokens = auth_usecase.login_user(
        UserLogin(username="deleteuser", password="Password123!")
    )
    del_res = auth_usecase.delete_user(tokens.access_token)
    assert del_res == {"message": "delete user successful"}


def test_profile_usecase_blocks_self_creation_and_deletion_and_allows_self_edit(
    auth_usecase, session
):
    creds = _make_user_create(username="profuser", email="prof@example.com")
    auth_usecase.create_user(creds)
    user = session.exec(select(User).where(User.email == "prof@example.com")).first()
    assert user is not None

    profile_uc = ProfileUsecase(session)
    profiles = profile_uc.list_profiles(user.user_id)
    assert len(profiles) == 1
    self_profile = profiles[0]

    # 1. Cannot create another 'self' profile via ProfileUsecase
    with pytest.raises(ValidationError):
        profile_uc.create_profile(
            ProfileWithConsentCreate(
                profile=_valid_profile_payload(relation="self"),
                consent=_valid_consent_payload(signer_relation="self"),
            ),
            user.user_id,
        )

    # 2. Can create a dependent ('child') profile
    dep_profile = profile_uc.create_profile(
        ProfileWithConsentCreate(
            profile=_valid_profile_payload(
                profile_name="Child Doe", dob="2015-05-01", relation="child"
            ),
            consent=_valid_consent_payload(signer_relation="parent"),
        ),
        user.user_id,
    )
    assert dep_profile.relation_to_account_holder == ProfileRelation.child

    # 3. Cannot delete the primary 'self' profile
    with pytest.raises(ConflictError):
        profile_uc.delete_profile(self_profile.profile_id, user.user_id)

    # 4. Can edit the primary 'self' profile (keeping relation as 'self')
    updated = profile_uc.update_profile(
        self_profile.profile_id,
        ProfileCreate(
            **_valid_profile_payload(profile_name="John Updated", relation="self")
        ),
        user.user_id,
    )
    assert updated.profile_name == "John Updated"

    # 5. Cannot change the primary 'self' profile relation to 'child'
    with pytest.raises(ValidationError):
        profile_uc.update_profile(
            self_profile.profile_id,
            ProfileCreate(
                **_valid_profile_payload(profile_name="John Updated", relation="child")
            ),
            user.user_id,
        )

    # 6. Cannot change a dependent profile relation to 'self'
    with pytest.raises(ValidationError):
        profile_uc.update_profile(
            dep_profile.profile_id,
            ProfileCreate(
                **_valid_profile_payload(profile_name="Child Doe", relation="self")
            ),
            user.user_id,
        )


def test_unverified_user_login_blocked_even_with_wrong_password(auth_usecase):
    creds = _make_user_create(username="unverified1", email="unverified1@example.com")
    auth_usecase.create_user(creds)

    with pytest.raises(UserNotConfirmedError):
        auth_usecase.login_user(
            UserLogin(username="unverified1", password="Password123!")
        )

    with pytest.raises(UserNotConfirmedError):
        auth_usecase.login_user(
            UserLogin(username="unverified1", password="WrongPassword!")
        )


def test_resend_confirmation_code_anti_enumeration_and_rate_limit(auth_usecase):
    creds = _make_user_create(username="resenduser", email="resend@example.com")
    auth_usecase.create_user(creds)

    # First resend succeeds
    assert auth_usecase.resend_confirmation_code("resenduser", client_ip="1.2.3.4") == {
        "message": "confirmation code sent"
    }

    # Immediate second resend hits 60s cooldown
    with pytest.raises(RateLimitError) as exc_info:
        auth_usecase.resend_confirmation_code("resenduser", client_ip="1.2.3.4")
    assert exc_info.value.retry_after is not None

    # Non-existent user returns generic 200 success (no enumeration)
    assert auth_usecase.resend_confirmation_code("ghost_user", client_ip="1.2.3.5") == {
        "message": "confirmation code sent"
    }

    # Confirmed user also returns generic 200 success
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="resenduser", confirmation_code="123456"),
        client_ip="1.2.3.4",
    )
    verification_rate_limiter.clear_all()
    assert auth_usecase.resend_confirmation_code("resenduser", client_ip="1.2.3.4") == {
        "message": "confirmation code sent"
    }


def test_confirm_user_rate_limited_after_five_attempts(auth_usecase):
    creds = _make_user_create(username="bruteuser", email="brute@example.com")
    auth_usecase.create_user(creds)

    for _ in range(5):
        with pytest.raises(BadRequestError):
            auth_usecase.confirm_user(
                ConfirmUserRequest(username="bruteuser", confirmation_code="000000"),
                client_ip="10.0.0.1",
            )

    with pytest.raises(RateLimitError):
        auth_usecase.confirm_user(
            ConfirmUserRequest(username="bruteuser", confirmation_code="123456"),
            client_ip="10.0.0.1",
        )


def test_cognito_service_login_unconfirmed_even_on_not_authorized():
    from botocore.exceptions import ClientError
    from services.auth.cognito_service import CognitoService

    class StubCognitoClient:
        def __init__(self, status: str):
            self.status = status

        def initiate_auth(self, **_kwargs):
            raise ClientError(
                {
                    "Error": {
                        "Code": "NotAuthorizedException",
                        "Message": "Incorrect username or password.",
                    }
                },
                "InitiateAuth",
            )

        def admin_get_user(self, **_kwargs):
            return {"UserStatus": self.status}

    unconfirmed_svc = CognitoService(
        client=StubCognitoClient("UNCONFIRMED"),
        client_id="cid",
        user_pool_id="pid",
    )
    with pytest.raises(UserNotConfirmedError):
        unconfirmed_svc.login_user(UserLogin(username="u1", password="wrong"))

    confirmed_svc = CognitoService(
        client=StubCognitoClient("CONFIRMED"),
        client_id="cid",
        user_pool_id="pid",
    )
    with pytest.raises(UnauthenticatedError):
        confirmed_svc.login_user(UserLogin(username="u1", password="wrong"))


def test_forgot_password_anti_enumeration_unconfirmed_and_rate_limit(auth_usecase):
    # 1. Non-existent user returns generic 200 success (no enumeration)
    assert auth_usecase.request_forgot_password("nonexistent_fp", client_ip="1.2.3.4") == {
        "message": "confirmation code sent to email"
    }

    # 2. Unconfirmed user raises UserNotConfirmedError
    creds = _make_user_create(username="fp_unconfirmed", email="fp_unconf@example.com")
    auth_usecase.create_user(creds)
    with pytest.raises(UserNotConfirmedError):
        auth_usecase.request_forgot_password("fp_unconfirmed", client_ip="1.2.3.4")

    # 3. Confirmed user succeeds, then hits 60s cooldown on immediate retry
    auth_usecase.confirm_user(
        ConfirmUserRequest(username="fp_unconfirmed", confirmation_code="123456"),
        client_ip="1.2.3.4",
    )
    verification_rate_limiter.clear_all()
    assert auth_usecase.request_forgot_password("fp_unconfirmed", client_ip="1.2.3.4") == {
        "message": "confirmation code sent to email"
    }
    with pytest.raises(RateLimitError):
        auth_usecase.request_forgot_password("fp_unconfirmed", client_ip="1.2.3.4")

    # 4. confirm_forgot_password locks after 5 failed attempts
    for _ in range(5):
        with pytest.raises(BadRequestError):
            auth_usecase.confirm_forgot_password(
                ForgotPasswordConfirm(
                    username="fp_unconfirmed",
                    confirmation_code="000000",
                    new_password="NewPassword123!",
                ),
                client_ip="1.2.3.4",
            )
    with pytest.raises(RateLimitError):
        auth_usecase.confirm_forgot_password(
            ForgotPasswordConfirm(
                username="fp_unconfirmed",
                confirmation_code="654321",
                new_password="NewPassword123!",
            ),
            client_ip="1.2.3.4",
        )


def test_cognito_service_forwards_aws_session_token(monkeypatch):
    import services.auth.cognito_service as cognito_mod

    captured: dict = {}

    class DummySession:
        def __init__(self, **kwargs):
            captured["session_kwargs"] = kwargs

        def client(self, service_name, region_name=None):
            captured["service_name"] = service_name
            captured["region_name"] = region_name
            return object()

    monkeypatch.setattr(cognito_mod.boto3, "Session", DummySession)
    monkeypatch.setattr(cognito_mod.settings, "AWS_PROFILE", None)
    monkeypatch.setattr(cognito_mod.settings, "AWS_ACCESS_KEY_ID", "ASIA_TEST_KEY")
    monkeypatch.setattr(cognito_mod.settings, "AWS_SECRET_ACCESS_KEY", "SECRET_TEST_KEY")
    monkeypatch.setattr(cognito_mod.settings, "AWS_SESSION_TOKEN", "SESSION_TOKEN_123")
    monkeypatch.setattr(cognito_mod.settings, "AWS_REGION", "ap-southeast-1")

    cognito_mod.CognitoService(client_id="cid", user_pool_id="pid")

    assert captured["session_kwargs"] == {
        "aws_access_key_id": "ASIA_TEST_KEY",
        "aws_secret_access_key": "SECRET_TEST_KEY",
        "aws_session_token": "SESSION_TOKEN_123",
    }
    assert captured["service_name"] == "cognito-idp"
    assert captured["region_name"] == "ap-southeast-1"


def test_create_user_rejects_duplicate_email_and_username(auth_usecase):
    first = _make_user_create(username="unique_user", email="Unique@Example.com")
    auth_usecase.create_user(first)

    # Duplicate email (case-insensitive) with different username
    with pytest.raises(ConflictError, match="email"):
        auth_usecase.create_user(
            _make_user_create(username="another_user", email="unique@example.com")
        )

    # Duplicate username with different email
    with pytest.raises(ConflictError):
        auth_usecase.create_user(
            _make_user_create(username="unique_user", email="other@example.com")
        )


def test_check_availability_reports_email_and_username(auth_usecase):
    auth_usecase.create_user(
        _make_user_create(username="taken_user", email="Taken@Example.com")
    )

    both_free = auth_usecase.check_availability(
        email="fresh@example.com", username="fresh_user"
    )
    assert both_free.email_available is True
    assert both_free.username_available is True

    email_taken = auth_usecase.check_availability(
        email="taken@example.com", username="fresh_user"
    )
    assert email_taken.email_available is False
    assert email_taken.username_available is True

    username_taken = auth_usecase.check_availability(
        email="fresh@example.com", username="taken_user"
    )
    assert username_taken.email_available is True
    assert username_taken.username_available is False

    both_taken = auth_usecase.check_availability(
        email="TAKEN@example.com", username="taken_user"
    )
    assert both_taken.email_available is False
    assert both_taken.username_available is False
