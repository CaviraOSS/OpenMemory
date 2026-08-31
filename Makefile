#      __                      __  ___
#     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
#    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
#   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
#  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
#                      /____/                                 /____/
#
#  cavira oss (c) 2026  -  nullure (c) 2026
#  ----------------------------------------------------------
#  file  : Makefile
#  usage : supports LongMemory makefile

.PHONY: help install build check benchmark serve dashboard extension package clean docker-build docker-up docker-down

help:
	@echo "LongMemory release commands"
	@echo "  make install       Install the pnpm workspace"
	@echo "  make build         Build the npm package"
	@echo "  make check         Run release checks without test suites"
	@echo "  make benchmark     Run the deterministic smoke benchmark gate"
	@echo "  make docker-up     Start API and MCP with Docker Compose"
	@echo "  make dashboard     Start API, MCP, and dashboard"

install:
	corepack enable
	pnpm install --frozen-lockfile

build:
	pnpm build

check:
	pnpm release:check

benchmark:
	pnpm bench:ci

serve: build
	pnpm start

extension:
	pnpm extension:build

package:
	pnpm pack
	pnpm extension:package

docker-build:
	docker build -t longmemory:local .

docker-up:
	docker compose up --build -d longmemory

dashboard:
	docker compose --profile ui up --build -d

docker-down:
	docker compose down

clean:
	rm -rf dist dashboard/.next apps/vscode-extension/dist integrations/n8n-nodes-longmemory/dist
