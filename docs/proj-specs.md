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
- Cognito — official: AWS Cognito login with Cognito Groups (client / psychologist / admin), verified on every request. Google OAuth / Supabase auth are not canonical.
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
- Auth: official decision is AWS Cognito + Cognito Groups verified per request. `User.cognito_sub` aligns; `python-jose` installed but JWT/Groups verification still unimplemented.
- Official queue rules (application-level, no schema change yet): exactly 3 `proposed_slots` per proposal; pick-up gated on `approval_status=approved`; finalization gated on `payments(status=paid)`; Flow A (admin-assign, pay-then-schedule) is legacy — see `system-flow-conflict.md`.
- Migrations: `alembic/versions/8bb9e943352d_initial_tables.py` creates all 9 tables.

See `backend/README.md` for run/migration guide. Do not duplicate it here.

## 3. Architecture Notes / Gaps

- Serverless: Mangum + NullPool is intentional for Lambda + Supabase PgBouncer.
- Auth decision: official Cognito Groups (verified per request in production; mocked role switcher in `frontend/` for initial UI).
- Payments: Stripe is specified but no webhook / `payments.status` state machine yet.
- CMS: Payload CMS scope is now services catalog, roster section structure, testimonials structure (no personal quotes in docs), Vision & Mission, Clinic Overview and Impact. See `services-catalog.md` and `site-map.md`.
- Frontend: `frontend/` exists (AI Studio Next.js prototype, mock-first). Run: `cd frontend; npm install; npm run dev` with `frontend/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:8000`, `NEXT_PUBLIC_AUTH_MODE=mock`). No backend dependency for initial UI. Contract map: see `frontend-backend-contract.md`.
- Missing from repo but mentioned in README: `common/middleware/error_middleware.py`, `Dockerfile`.
- Known typo: `PsychologistProfile.liscence_number` should be `licence_number` / `license_number` — needs migration if renamed.

## 4. Spec Decisions Needed

1. Auth provider: decided — Cognito Groups (implement verification; mocked in frontend).
2. Payment order: decided official — schedule-then-pay with payment-gated finalization. Flow A pay-then-schedule is legacy.
3. Calendar source: per-psychologist availability vs per-appointment `proposed_slots` (exactly 3); Calendly-like UX requested Sept 9.
4. Messaging: source mentions `Alternative where the website has its own messaging feature` (image3 missing) — in-scope or out?
5. CMS scope: which pages are Payload-driven vs hardcoded? Current answer: services, roster structure, testimonials structure, Vision/Mission, Clinic Overview are CMS-driven; personal names/quotes stay out of docs.
6. Facebook page URL + Vision/Mission + Clinic Overview copy still pending from stakeholders.

## 5. Brand Tokens (from deck Image 2)

- Fonts: preferably sans-serif — `Proxima Nova Condensed` and `Aileron`.
- Colors: `#25372D`, `#D0E187`, `#5D8B69`, `#8FBE8F`, `#C0D3C3`.
- Logo: `PSYCHAVE PH` badge (asset pending; do not embed from screenshot).
- Contact config: `psychaveph.info@gmail.com`; Facebook page URL pending. `Book a session` links are external config, not app routes. See `site-map.md`.

## Sources

- Official revised plan 2026-09-27 + `TechStack` notes + `backend/requirements.txt`, `backend/src/*`, `backend/README.md`.
