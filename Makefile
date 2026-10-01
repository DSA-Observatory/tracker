.PHONY: dev dev-web dev-prod down restart logs ps clean

COMPOSE ?= docker compose

dev:
	$(COMPOSE) up

dev-web:
	$(COMPOSE) up -d pocketbase
	@set -a; [ ! -f .env ] || . ./.env; set +a; \
		bun install && bun run dev -- --host 0.0.0.0 --port "$${FRONTEND_PORT:-64010}"

dev-prod:
	@set -a; [ ! -f .env ] || . ./.env; set +a; \
		case "$${POCKETBASE_PROD_URL:-}" in \
			https://?*) ;; \
			*) echo "Set POCKETBASE_PROD_URL to the production HTTPS URL in .env." >&2; exit 1 ;; \
		esac; \
		export PUBLIC_POCKETBASE_URL="$$POCKETBASE_PROD_URL" POCKETBASE_URL="$$POCKETBASE_PROD_URL"; \
		echo "WARNING: Using production PocketBase ($$POCKETBASE_PROD_URL). App writes affect production data."; \
		bun install && bun run dev -- --host 0.0.0.0 --port "$${FRONTEND_PORT:-64010}"

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) down
	$(COMPOSE) up

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

clean:
	$(COMPOSE) down --remove-orphans
