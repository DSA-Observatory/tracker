.PHONY: dev dev-web down restart logs ps clean

COMPOSE ?= docker compose

dev:
	$(COMPOSE) up

dev-web:
	$(COMPOSE) up -d pocketbase
	@set -a; [ ! -f .env ] || . ./.env; set +a; \
		bun install && bun run dev -- --host 0.0.0.0 --port "$${FRONTEND_PORT:-46217}"

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
