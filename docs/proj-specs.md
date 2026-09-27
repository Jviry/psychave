# Project Specs — PsychAvenuePH

## 1. Tech Stack (as given in source notes)

### Frontend

- Next.js
- Shadcn
- Zustand — for global state management
- Zod — data schema validation
- React Hook Form
- TanStack Query

### Backend

- FastAPI
- API Gateway
- Lambda — Serverless
- Postgres
- Cognito — Login / Google OAuth / Supabase auth (source lists all three; needs decision)
- Stripe — Payment Gateway
- Payload CMS

### DB / ORM

- SQLModel
- Alembic
- PostgreSQL / Supabase

> Note: `backend/requirements.txt` currently pins `FastAPI==0.141.1`, `SQLModel==0.0.42`, `SQLAlchemy==2.0.52`, `alembic==1.20.0`, `psycopg`, `mangum`, `python-jose`, etc. Stripe SDK, Payload CMS client, and Next.js deps are not yet in the repo.

## 2. Current Backend Reality (matches specs partially)

- Entry: `backend/src/main.py` — FastAPI + CORS + `app_router` + `GET /health` + Mangum handler for Lambda.
- Config: `backend/src/common/settings.py` — `APP_NAME, ENV, DEBUG, PORT, HOST, DATABASE_URL, CORS_ORIGINS, SECRET_KEY` via `pydantic-settings`.
- DB: `backend/src/common/database.py` — `create_engine(DATABASE_URL, NullPool)` + `get_db()`; Alembic uses `SQLModel.metadata`.
- Models (9 tables, UUID PKs): `users`, `admin_profiles`, `psychologist_profiles`, `client_profiles`, `persona`, `forms`, `appointments`, `proposed_slots` (circular FK with `appointments.selected_slot_id`), `payments`.
- Controllers: `app_router` aggregates `auth_controller.router` (currently empty — no endpoints).
- Layers `repo/user_repo.py`, `usecase/user_usecase.py`, `services/`, `utils/` are stubs.
- Auth: `User.cognito_sub` implies Cognito IdP; `python-jose` installed but unused. No JWT verification yet.
- Migrations: `alembic/versions/8bb9e943352d_initial_tables.py` creates all 9 tables.

See `backend/README.md` for run/migration guide. Do not duplicate it here.

## 3. Architecture Notes / Gaps

- Serverless: Mangum + NullPool is intentional for Lambda + Supabase PgBouncer.
- Auth decision needed: Cognito vs Supabase Auth vs Google OAuth — source lists `Cognito - Login / Google oauth / supabase auth` as one line. Pick one IdP; `cognito_sub` column assumes Cognito.
- Payments: Stripe is specified but no webhook / `payments.status` state machine yet.
- CMS: Payload CMS is listed but no integration point defined (likely for landing / services / doctor profiles content).
- Frontend has no repo folder yet; requirements call for Admin Page, Psychology dashboard, Calendar, Landing page.
- Missing from repo but mentioned in README: `common/middleware/error_middleware.py`, `Dockerfile`.
- Known typo: `PsychologistProfile.liscence_number` should be `licence_number` / `license_number` — needs migration if renamed.

## 4. Spec Decisions Needed

1. Auth provider canonical choice.
2. Payment order (see `system-flow-conflict.md`): pay-then-schedule (Flow A) vs schedule-then-pay (Flow B).
3. Calendar source: per-psychologist availability vs per-appointment `proposed_slots`; Calendly-like UX requested Sept 9.
4. Messaging: source mentions `Alternative where the website has its own messaging feature` (image3 missing) — in-scope or out?
5. CMS scope: which pages are Payload-driven vs hardcoded?

## Sources

- `TechStack` notes section + `backend/requirements.txt`, `backend/src/*`, `backend/README.md`.
