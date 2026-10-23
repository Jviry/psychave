.PHONY: help db-start db-stop db-status db-reset db-migrate db-migrate-down db-new-migration test test-unit test-integration dev

VENV := .venv/bin
PYTHON := $(VENV)/python
PYTEST := $(VENV)/pytest
ALEMBIC := $(VENV)/alembic
UVICORN := $(VENV)/uvicorn
SUPABASE := npx --yes supabase

DB_URL := postgresql://postgres:postgres@127.0.0.1:54322/postgres
TEST_DB_URL := postgresql://postgres:postgres@127.0.0.1:54322/postgres_test

help:
	@echo "Available commands:"
	@echo "  make db-start          - Start local Supabase instance (PostgreSQL, Studio, Kong)"
	@echo "  make db-stop           - Stop local Supabase instance"
	@echo "  make db-status         - Show local Supabase connection details and Studio URL"
	@echo "  make db-reset          - Reset Supabase DB and reapply initial migrations and seed data"
	@echo "  make db-migrate        - Apply pending Alembic migrations to local Supabase database"
	@echo "  make db-migrate-down   - Revert the last Alembic migration"
	@echo "  make db-new-migration  - Generate a new Alembic migration (usage: make db-new-migration name=\"my_change\")"
	@echo "  make test              - Run all tests (unit and integration tests against local Supabase)"
	@echo "  make test-unit         - Run unit tests only"
	@echo "  make test-integration  - Run Supabase integration tests only"
	@echo "  make dev               - Start FastAPI development server with reload"

db-start:
	$(SUPABASE) start

db-stop:
	$(SUPABASE) stop

db-status:
	$(SUPABASE) status

db-reset:
	$(SUPABASE) db reset

db-migrate:
	DATABASE_URL="$(DB_URL)" $(ALEMBIC) upgrade head

db-migrate-down:
	DATABASE_URL="$(DB_URL)" $(ALEMBIC) downgrade -1

db-new-migration:
	@if [ -z "$(name)" ]; then echo "Error: Please specify migration name, e.g. make db-new-migration name=add_field"; exit 1; fi
	DATABASE_URL="$(DB_URL)" $(ALEMBIC) revision --autogenerate -m "$(name)"

test:
	$(PYTEST) -v

test-unit:
	$(PYTEST) tests/unit -v

test-integration:
	PYTEST_STRICT_INTEGRATION=1 $(PYTEST) tests/integration -v

dev:
	DATABASE_URL="$(DB_URL)" $(UVICORN) main:app --app-dir src --reload --host 0.0.0.0 --port 8000
