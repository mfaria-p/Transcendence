SHELL = /bin/bash
CONF = ./srcs/docker-compose.yml
ENV = ./srcs/.env

build:
	docker compose -f $(CONF) build $(service)

rebuild:
	docker compose -f $(CONF) build --force-rm --no-cache $(service)

up:
	docker compose -f $(CONF) up -d $(service)

down:
	docker compose -f $(CONF) down $(service)

clean:
	docker compose -f $(CONF) down $(service) --rmi all

fclean:
	docker compose -f $(CONF) down $(service) --rmi all -v

restart:
	docker compose -f $(CONF) restart $(service)

re: fclean rebuild up

del:
	docker volume rm $(volume)

.PHONY: build rebuild up down clean fclean restart re del
