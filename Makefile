.PHONY: help db-start db-stop db-status db-reset db-migrate db-migrate-down db-new-migration test test-unit test-integration dev

help:
	@$(MAKE) -C backend help

db-start:
	@$(MAKE) -C backend db-start

db-stop:
	@$(MAKE) -C backend db-stop

db-status:
	@$(MAKE) -C backend db-status

db-reset:
	@$(MAKE) -C backend db-reset

db-migrate:
	@$(MAKE) -C backend db-migrate

db-migrate-down:
	@$(MAKE) -C backend db-migrate-down

db-new-migration:
	@$(MAKE) -C backend db-new-migration name="$(name)"

test:
	@$(MAKE) -C backend test

test-unit:
	@$(MAKE) -C backend test-unit

test-integration:
	@$(MAKE) -C backend test-integration

dev:
	@$(MAKE) -C backend dev
