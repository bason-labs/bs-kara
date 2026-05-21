SHELL := /bin/bash
.DEFAULT_GOAL := help

# ─── Install & Start ─────────────────────────────────────────

.PHONY: install
install: ## Install all workspace dependencies
	pnpm install

.PHONY: dev
dev: ## Start the web dev server (localhost:3000)
	pnpm run dev

.PHONY: dev-mobile
dev-mobile: ## Start the Expo mobile dev server
	pnpm run dev:mobile

.PHONY: dev-all
dev-all: ## Start web + mobile dev servers concurrently
	pnpm run dev:all

# ─── Build ───────────────────────────────────────────────────

.PHONY: build
build: ## Build all packages (bk-shared → bk-web)
	pnpm run build

.PHONY: build-web
build-web: ## Build bk-web only
	cd bk-web && npm run build

# ─── Test ────────────────────────────────────────────────────

.PHONY: test
test: ## Run all unit tests (bk-shared + bk-web)
	pnpm run test

.PHONY: test-shared
test-shared: ## Run bk-shared tests only
	cd bk-shared && pnpm test

.PHONY: test-web
test-web: ## Run bk-web Vitest tests only
	cd bk-web && npx vitest run

.PHONY: test-e2e
test-e2e: ## Run Playwright E2E tests (requires built app)
	npx playwright test

.PHONY: test-e2e-ui
test-e2e-ui: ## Run Playwright E2E tests with UI mode
	npx playwright test --ui

.PHONY: test-all
test-all: test test-e2e ## Run all tests (unit + E2E)

# ─── Lint & Typecheck ────────────────────────────────────────

.PHONY: lint
lint: ## Lint all packages
	pnpm run lint

.PHONY: typecheck
typecheck: ## Typecheck all packages
	pnpm run typecheck

.PHONY: typecheck-shared
typecheck-shared: ## Typecheck bk-shared only
	cd bk-shared && npx tsc --noEmit

.PHONY: typecheck-web
typecheck-web: ## Typecheck bk-web only
	cd bk-web && npx tsc --noEmit

# ─── Check (all-in-one gate) ─────────────────────────────────

.PHONY: check
check: typecheck lint test ## Fast gate — typecheck + lint + unit tests
	@echo "✅ check passed"

# ─── Mobile CI ───────────────────────────────────────────────

.PHONY: mobile-build-dev
mobile-build-dev: ## Trigger EAS development build (iOS + Android)
	cd bk-mobile && npx eas-cli build --platform all --profile development --non-interactive

.PHONY: mobile-build-preview
mobile-build-preview: ## Trigger EAS preview build
	cd bk-mobile && npx eas-cli build --platform all --profile preview --non-interactive

# ─── Utilities ───────────────────────────────────────────────

.PHONY: clean
clean: ## Remove build artifacts (.next, dist, coverage)
	rm -rf bk-web/.next bk-shared/dist bk-web/coverage bk-shared/coverage

.PHONY: clean-all
clean-all: clean ## Remove build artifacts AND node_modules (full reset)
	rm -rf node_modules bk-web/node_modules bk-shared/node_modules bk-mobile/node_modules

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
