.PHONY: dev down restart logs ps clean

COMPOSE ?= docker compose

dev:
	$(COMPOSE) up

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
