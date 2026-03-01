.PHONY: install dev test build docker clean

install: ## Install all dependencies
	cd backend && npm install
	cd frontend && npm install

dev: ## Start development servers
	npx concurrently "cd backend && npm run dev" "cd frontend && npm run dev"

test: ## Run all tests
	cd backend && npm test

build: ## Build for production
	cd backend && npm run build
	cd frontend && npm run build

docker: ## Start with Docker Compose
	docker-compose up --build

docker-down: ## Stop Docker Compose
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

db-migrate: ## Run database migrations
	cd backend && npx prisma migrate dev

db-studio: ## Open Prisma Studio
	cd backend && npx prisma studio

clean: ## Clean build artifacts and node_modules
	rm -rf backend/dist backend/node_modules
	rm -rf frontend/dist frontend/node_modules

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
