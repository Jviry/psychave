# PsychAve Backend

FastAPI + SQLModel backend service for the PsychAve platform.

---

## Tech Stack

- **Framework**: [FastAPI](https://fastapi.tiangolo.com/)
- **ORM / Schema**: [SQLModel](https://sqlmodel.tiangolo.com/) (combines Pydantic & SQLAlchemy 2.0)
- **Database Migrations**: [Alembic](https://alembic.sqlalchemy.org/)
- **Database**: PostgreSQL (via `psycopg` / `psycopg2`)
- **Serverless Adapter**: [Mangum](https://mangum.io/) (ASGI handler for AWS Lambda / API Gateway)
- **Configuration**: Pydantic Settings (`pydantic-settings`)
- **Python Version**: 3.12+

---

## Project Structure

```text
backend/
├── alembic/                      # Database migrations
│   ├── env.py                    # Alembic runtime configuration & metadata hook
│   ├── script.py.mako            # Migration template (imports sqlmodel)
│   └── versions/                 # Generated migration scripts
│       └── 8bb9e943352d_initial_tables.py
├── src/                          # Application source code
│   ├── common/                   # Shared utilities & configs
│   │   ├── database.py           # SQLModel engine & get_db session dependency
│   │   ├── settings.py           # App settings & env loading
│   │   └── middleware/
│   │       └── error_middleware.py # Global & custom error handlers
│   ├── controllers/              # API endpoints and route handlers
│   │   ├── app_router.py         # Main router aggregating controller routes
│   │   └── auth_controller.py    # Authentication routes
│   ├── models/                   # SQLModel table definitions
│   │   ├── __init__.py           # Exported models (required for Alembic detection)
│   │   ├── user.py               # Base User table (Cognito sub, email, role)
│   │   ├── admin_profile.py      # Admin profile extension
│   │   ├── psychologist_profile.py # Psychologist profile & verification
│   │   ├── client_profile.py     # Client profile extension
│   │   ├── persona.py            # Client personas (multiple personas per client)
│   │   ├── forms.py              # Intake / consultation forms
│   │   ├── appointment.py        # Consultation appointments
│   │   ├── proposed_slot.py      # Available / proposed time slots
│   │   └── payment.py            # Payment records
│   ├── seed_services.py          # Idempotent services catalog seed
│   └── main.py                   # FastAPI entry point & Mangum handler
├── .env.example                  # Environment variable reference
├── alembic.ini                   # Alembic configuration
├── Dockerfile                    # Containerization spec
├── pyrightconfig.json            # Pyright / VS Code LSP configuration
└── requirements.txt              # Project dependencies
```

---

## Getting Started

### 1. Environment Configuration

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `APP_NAME` | Service title shown in docs | `Psychave API` |
| `ENV` | Environment name (`development`, `production`) | `development` |
| `DEBUG` | Enable debug mode and SQL query echo | `true` |
| `PORT` | Local server port | `8000` |
| `HOST` | Local server host | `0.0.0.0` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@localhost:5432/postgres` |
| `CORS_ORIGINS` | Allowed CORS origins (JSON array) | `["http://localhost:3000","http://localhost:5173"]` |
| `SECRET_KEY` | Application secret key | - |

### 2. Virtual Environment Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Run Migrations

Before running the server, apply database migrations:

```bash
alembic upgrade head
```

### 4. Seed the Services Catalog

The `services` table ships empty. Seed the seven catalog entries from
`docs/services-catalog.md` with:

```bash
python src/seed_services.py
```

The script is idempotent — it upserts by a stable UUID per service slug, so
re-running updates the copy instead of creating duplicates. Existing
appointments that reference a seeded service are unaffected.

### 5. Start Development Server

Run Uvicorn with `--app-dir src` to ensure modules resolve correctly:

```bash
uvicorn main:app --app-dir src --reload --port 8000
```

- **API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Documentation (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## Authentication & Authorization

Two layers, different jobs:

| Layer | Where | Job |
| :--- | :--- | :--- |
| Gateway JWT authorizer | Prod only (`infra/modules/apigateway`) | Rejects bad/expired tokens before Lambda runs. Accepts both ID and access tokens. Knows nothing about users or groups. |
| `verify_token()` (`src/common/security/cognito.py`) | App (`src/dependencies/auth.py`) | Verifies the signature **and decodes claims** (`sub`, `email`, `cognito:groups`). The only layer that works under local `uvicorn`, which bypasses the gateway. |

The gateway never hands decoded claims to FastAPI — the app only sees the raw `Authorization` header, so `verify_token()` cannot be deleted without leaving the app blind.

### Token contract (frontend)

Always send the **ID token**: `Authorization: Bearer <id_token>`. `verify_token()` enforces `audience = COGNITO_APP_CLIENT_ID`, which only ID tokens satisfy — access tokens carry `client_id` instead of `aud` and are rejected by the app even though the gateway lets them through.

### Identity and roles

- `get_claims()` — parses + verifies the Bearer token. Raises domain errors (`UnauthenticatedError`), mapped to `401` by handlers in `src/main.py`.
- `get_current_user()` — maps `claims["sub"]` to the `users` row via `UserRepository`. Raises `UserNotFoundError` (`401`) when the row is missing.
- `require_role(UserRole.ADMIN, ...)` — checks the `cognito:groups` claim from the pool groups (`admin` / `psychologist` / `client`), not the DB `role` column, then resolves and returns the `users` row (`User`) so handlers can use `current_user.user_id`. Raises `ForbiddenError` (`403`).
- `get_current_psychologist()` — `require_role(PSYCHOLOGIST)` plus the `psychologist_profiles` row for that user. Raises `ForbiddenError` when the profile is missing.
- The DB `role` column is a cached copy for queries/joins only; Cognito groups are the source of truth for access. `AuthUsecase` reconciles the cached role from live groups on confirm/login.

### Psychologist dashboard endpoints

All routes below require the `psychologist` Cognito group (`require_role(UserRole.PSYCHOLOGIST)`). Psychologists are created by admin promotion, so there is no separate credential-approval gate.

| Route | Notes |
| :--- | :--- |
| `GET /appointments/pending` | Unclaimed requests (`psychologist_id IS NULL`, `status = pending`) |
| `POST /appointments/{id}/pickup` | Sets `psychologist_id` + `price`, moves status to `awaiting_slot_selection` |
| `POST /appointments/{id}/slots` | Body is a list of exactly 3 `{session_date, start_time, end_time?}` proposals; rejects duplicates/past times and re-proposals |
| `GET /appointments/mine` | Own appointments, optional `?status=` filter |
| `GET /appointments/{id}` | Shared with the client route (same path) — branches on the caller's role; psychologists only ever see appointments they own (others → `404`) |
| `GET /psychologist-profile/me` | Own profile |
| `PATCH /psychologist-profile/me` | Writable: `specialization`, `license_number`, `bio`, `social_media_links` |

### Admin role management

Self-service signup always creates a **client**. Only an admin can turn a client into a psychologist:

| Route | Notes |
| :--- | :--- |
| `GET /admin/users?role=client&search=` | Lists accounts (defaults to clients) so an admin can find the user to promote |
| `POST /admin/users/{user_id}/promote` | Body: `full_name` (required), `license_number?`, `specialization?`, `bio?`, `social_media_links?`. Swaps the Cognito group to `psychologist`, updates `users.role`, and creates the `psychologist_profiles` row. The existing `client_profiles` row is kept because personas reference it. |

Both routes require the `admin` Cognito group. Promotion only works in one direction (client → psychologist). The promoted user must sign in again before their ID token carries the new `psychologist` group claim.

### Lifecycle

1. `POST /auth/create-user` (client-only; the payload has no `role` field) → Cognito `sign_up` + `admin_add_user_to_group` for `client`, then the local `User` row (from the returned `UserSub`) and `client_profiles` row are created immediately. Older clients that still send `role`/`full_name` are ignored by the request schema, so a role can never be self-assigned. Lambda needs the `cognito_admin` IAM policy for these Admin APIs.
2. `POST /auth/confirm` → `confirm_sign_up`, then inserts/reconciles `User(cognito_sub, email, role-from-groups)` **and the role's profile row** (`client_profiles` / `psychologist_profiles` / `admin_profiles`, idempotent). Admin promotion normally creates the psychologist profile before this point.
3. `POST /auth/login` → returns tokens and lazily inserts the `User` row for users created before local sync existed (best-effort; never fails login). Also heals a **missing role profile row** and reconciles a stale cached role from live Cognito groups.
4. Admins promote clients with `POST /admin/users/{user_id}/promote`; this updates Cognito groups and the local role/profile in one action.
5. Session endpoints (`/auth/me`, `/auth/logout`, `/auth/delete`) require `Depends(get_current_user)`; the pure auth flows (login/signup/confirm/refresh/password) stay public and are also exempt from the gateway authorizer.

---

## 🗄 Database & Migrations Guide (Alembic + SQLModel)

This project uses **SQLModel** models and **Alembic** to manage database schema versions.

### How it Works

1. **Model Discovery**:
   - `alembic/env.py` binds to `SQLModel.metadata` as `target_metadata`.
   - In `alembic/env.py`, models are imported via:

     ```python
     from src.models import *
     ```

   - **Crucial Rule**: Whenever you create a new model in `src/models/`, you **must** import and expose it inside `src/models/__init__.py`. If you omit this, Alembic will **not** detect your model during autogeneration.

2. **Database Connection in Alembic**:
   - `alembic/env.py` reads `settings.DATABASE_URL` directly from `src.common.settings.settings`. You do not need to hardcode database credentials in `alembic.ini`.

3. **Template Support**:
   - `alembic/script.py.mako` imports `sqlmodel` by default so generated migrations can safely reference `sqlmodel.sql.sqltypes.AutoString()` without throwing `NameError`.

---

### Migration Cheatsheet

Always run alembic commands from the `backend/` root directory where `alembic.ini` is located:

#### 1. Apply all pending migrations

```bash
alembic upgrade head
```

#### 2. Generate a new migration after modifying models

```bash
alembic revision --autogenerate -m "describe_your_changes"
```

#### 3. Inspect migration history and current database state

```bash
# View the current revision of the target DB
alembic current

# View history of all revisions
alembic history --verbose
```

#### 4. Rollback migrations

```bash
# Rollback the last migration
alembic downgrade -1

# Rollback to a specific revision
alembic downgrade <revision_id>

# Rollback everything to clean database
alembic downgrade base
```

---

### Important Migration Tips & Gotchas

1. **Always Review Autogenerated Files**:
   Alembic's `--autogenerate` detects table creation, added/dropped columns, and indexes. However:
   - It cannot detect renamed columns (it generates a drop column + add column, which loses data).
   - Check foreign key ordering and circular dependencies manually.

2. **Circular Foreign Keys**:
   - Example in this codebase: `appointments.selected_slot_id` references `proposed_slots.slot_id`, while `proposed_slots.appointment_id` references `appointments.appointment_id`.
   - In `alembic/versions/8bb9e943352d_initial_tables.py`, the `selected_slot_id` foreign key is added via `op.create_foreign_key()` *after* `proposed_slots` is created, and dropped explicitly in `downgrade()`. Keep this in mind when dealing with circular references.

3. **NullPool**:
   - Both the runtime engine (`src/common/database.py`) and Alembic (`alembic/env.py`) use `NullPool`. This prevents persistent connection pool exhaustion when deployed on serverless runtimes (such as AWS Lambda via Mangum) or database connection proxies (like Supabase Transaction Pooler / PgBouncer).
