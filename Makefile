SHELL := /bin/bash

APP_NAME := arcade
APP_PATH := ./cmd/arcade
BUILD_PATH := ./dist
WEB_DIR := ./web
EMBED_DIR := ./internal/frontend/dist

GO ?= go
NPM ?= npm

BUILD_DATE := $(shell date +'%F %T')
GIT_BRANCH := -
GIT_COMMIT := -
GIT_REVISION := -

ifneq ($(wildcard .git),)
GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo -)
GIT_COMMIT := $(shell git rev-list --count HEAD 2>/dev/null || echo -)
GIT_REVISION := $(shell git rev-parse --short HEAD 2>/dev/null || echo -)
endif

FLAGS_PKG := github.com/wonli/aqi
LDFLAGS := -X '$(FLAGS_PKG).BuildDate=$(BUILD_DATE)' \
	-X '$(FLAGS_PKG).Branch=$(GIT_BRANCH)' \
	-X '$(FLAGS_PKG).CommitVersion=$(GIT_COMMIT)' \
	-X '$(FLAGS_PKG).Revision=$(GIT_REVISION)' \
	-s -w

GO_FLAGS := -trimpath -tags netgo -ldflags "$(LDFLAGS)"

.PHONY: help setup deps frontend web-dev backend dev build start test clean dungeon-assets game-assets

help:
	@echo "AQI Arcade"
	@echo ""
	@echo "  make start          Install/build everything and run one embedded Go binary"
	@echo "  make dev            Rebuild frontend, then run the Go server on :8080"
	@echo "  make build          Build frontend and dist/arcade single binary"
	@echo "  make test           Run frontend tests/build and all Go tests"
	@echo "  make setup          Resolve Go modules and install locked frontend dependencies"
	@echo "  make frontend       Install locked frontend dependencies and build embedded assets"
	@echo "  make web-dev        Optional Vite HMR server for frontend-only development"
	@echo "  make backend        Rebuild frontend, then run only the Go server"
	@echo "  make clean          Remove generated build output"

setup:
	$(GO) mod tidy
	cd $(WEB_DIR) && $(NPM) ci

deps: setup

dungeon-assets:
	node ./scripts/prepare-dungeon-assets.mjs

game-assets: dungeon-assets

frontend: game-assets
	cd $(WEB_DIR) && $(NPM) ci
	cd $(WEB_DIR) && $(NPM) run build
	@touch $(EMBED_DIR)/.gitkeep

# Optional frontend-only workflow. The default project workflow does not need Vite.
web-dev: game-assets
	cd $(WEB_DIR) && $(NPM) ci
	cd $(WEB_DIR) && $(NPM) run dev -- --host 0.0.0.0

backend: frontend
	$(GO) run $(APP_PATH)

dev: frontend
	$(GO) mod tidy
	$(GO) run $(APP_PATH)

build: frontend
	$(GO) mod tidy
	mkdir -p $(BUILD_PATH)
	CGO_ENABLED=0 $(GO) build $(GO_FLAGS) -o $(BUILD_PATH)/$(APP_NAME) $(APP_PATH)
	@echo ""
	@echo "Build complete: $(BUILD_PATH)/$(APP_NAME)"
	@echo "Frontend is embedded in the binary."

start: build
	./$(BUILD_PATH)/$(APP_NAME)

test: game-assets
	cd $(WEB_DIR) && $(NPM) ci
	cd $(WEB_DIR) && $(NPM) test
	cd $(WEB_DIR) && $(NPM) run build
	@touch $(EMBED_DIR)/.gitkeep
	$(GO) mod tidy
	$(GO) test ./...

clean:
	rm -rf $(BUILD_PATH)
	mkdir -p $(EMBED_DIR)
	find $(EMBED_DIR) -mindepth 1 -maxdepth 1 ! -name '.gitkeep' -exec rm -rf {} +
	@touch $(EMBED_DIR)/.gitkeep
