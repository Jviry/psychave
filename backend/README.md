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

### 4. Start Development Server

Run Uvicorn with `--app-dir src` to ensure modules resolve correctly:

```bash
uvicorn main:app --app-dir src --reload --port 8000
```

- **API Documentation (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Alternative Documentation (ReDoc)**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

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
