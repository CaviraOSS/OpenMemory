# Makefile for OpenMemory

.PHONY: help install build test clean dev start stop lint format

# Default target
help: ## Show this help message
	@echo "OpenMemory Development Commands"
	@echo "==============================="
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation and Setup
install: ## Install all dependencies
	@echo "📦 Installing JavaScript (server + SDK) dependencies..."
	cd packages/openmemory-js && npm install
	@echo "📦 Installing Python SDK dependencies..."
	cd packages/openmemory-py && pip install -e .
	@echo "✅ All dependencies installed!"

install-dev: ## Install development dependencies
	@echo "🛠️ Installing development dependencies..."
	cd packages/openmemory-js && npm install
	cd packages/openmemory-py && pip install -e .[dev]
	@echo "✅ Development dependencies installed!"

# Build
build: ## Build all components
	@echo "🏗️ Building JavaScript (server + SDK)..."
	cd packages/openmemory-js && npm run build
	@echo "✅ All components built!"

build-backend: ## Build backend only
	cd packages/openmemory-js && npm run build

build-js-sdk: ## Build JavaScript SDK only
	cd packages/openmemory-js && npm run build

# Development
dev: ## Start development server
	@echo "🚀 Starting development server..."
	cd packages/openmemory-js && npm run dev

dev-watch: ## Start development server with file watching
	@echo "👀 Starting development server with watching..."
	cd packages/openmemory-js && npm run dev

# Production
start: ## Start production server
	@echo "🚀 Starting production server..."
	cd packages/openmemory-js && npm run start

stop: ## Stop server (if running as daemon)
	@echo "🛑 Stopping server..."
	@pkill -f "node.*openmemory" || echo "No server process found"

# Testing
test: ## Run all tests
	@echo "🧪 Running all tests..."
	@echo "Testing JavaScript (server + SDK)..."
	cd packages/openmemory-js && npx tsx tests/verify.ts
	@echo "Testing Python SDK..."
	cd packages/openmemory-py && python -m pytest -q

test-backend: ## Run backend tests only
	@echo "🧪 Testing JavaScript (server + SDK)..."
	cd packages/openmemory-js && npx tsx tests/verify.ts

test-js-sdk: ## Run JavaScript SDK tests only
	@echo "🧪 Testing JavaScript (server + SDK)..."
	cd packages/openmemory-js && npx tsx tests/verify.ts

test-py-sdk: ## Run Python SDK tests only
	@echo "🧪 Testing Python SDK..."
	cd packages/openmemory-py && python -m pytest -q

test-integration: ## Run integration tests
	@echo "🔗 Running integration tests..."
	cd packages/openmemory-js && npx tsx tests/test_omnibus.ts

# Code Quality
lint: ## Run linters
	@echo "🔍 Running linters..."
	cd packages/openmemory-js && npx prettier --check "src/**/*.ts" "tests/**/*.ts" || echo "JS formatting check completed"
	cd packages/openmemory-py && python -m black --check . || echo "Python formatting check completed"

format: ## Format code
	@echo "🎨 Formatting code..."
	cd packages/openmemory-js && npm run format || echo "JS formatting completed"
	cd packages/openmemory-py && python -m black . || echo "Python formatting completed"

type-check: ## Run type checking
	@echo "🏷️ Running type checks..."
	cd packages/openmemory-js && npx tsc --noEmit

# Database
db-reset: ## Reset database
	@echo "🗄️ Resetting database..."
	rm -f packages/openmemory-js/data/*.sqlite
	@echo "✅ Database reset!"

db-backup: ## Backup database
	@echo "💾 Backing up database..."
	mkdir -p backups
	cp packages/openmemory-js/data/*.sqlite backups/ || echo "No database files found"
	@echo "✅ Database backed up!"

# Docker
docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t openmemory .

docker-run: ## Run Docker container
	@echo "🐳 Running Docker container..."
	docker run -p 18080:18080 openmemory

docker-dev: ## Run development environment with Docker
	@echo "🐳 Starting development environment..."
	docker compose up --build openmemory

docker-stop: ## Stop Docker containers
	@echo "🐳 Stopping Docker containers..."
	docker compose down

run: docker-dev ## Alias for docker-dev

# Cleanup
clean: ## Clean build artifacts
	@echo "🧹 Cleaning build artifacts..."
	rm -rf packages/openmemory-js/dist/
	rm -rf packages/openmemory-js/node_modules/.cache/
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} + || true
	@echo "✅ Cleanup complete!"

clean-all: clean ## Clean everything including node_modules
	@echo "🧹 Deep cleaning..."
	rm -rf packages/openmemory-js/node_modules/
	rm -rf packages/openmemory-py/build/
	rm -rf packages/openmemory-py/dist/
	rm -rf packages/openmemory-py/*.egg-info/
	@echo "✅ Deep cleanup complete!"

# Examples
run-examples: ## Run example files
	@echo "🎯 Running examples..."
	@echo "Backend examples:"
	node examples/backend/basic-server.js &
	sleep 2
	node examples/backend/api-test.mjs
	@echo "JavaScript SDK examples:"
	node examples/js-sdk/basic-usage.js
	@echo "Python SDK examples:"
	cd examples/py-sdk && python basic_usage.py

# Development Utilities
reset-dev: clean install build ## Reset development environment
	@echo "🔄 Development environment reset complete!"

quick-test: build test-backend ## Quick test after build
	@echo "⚡ Quick test complete!"

full-check: clean install build lint test ## Full check before commit
	@echo "✅ Full check complete - ready to commit!"
