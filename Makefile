SHELL := /bin/bash

APP_NAME := arcade
APP_PATH := ./cmd/arcade
BUILD_PATH := ./dist
WEB_DIR := ./web
WEB_BUILD_DIR := $(WEB_DIR)/dist
WEB_DIST_DIR := $(BUILD_PATH)/web

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

.PHONY: help setup deps dev backend frontend build backend-build frontend-build start test clean

help:
	@echo "AQI Arcade"
	@echo ""
	@echo "  make setup          Install/resolve Go and web dependencies"
	@echo "  make dev            Install dependencies and start backend + frontend dev servers"
	@echo "  make build          Build backend binary and frontend into ./dist"
	@echo "  make start          Build, then run backend + frontend preview"
	@echo "  make backend        Start only the Go backend"
	@echo "  make frontend       Start only the Vite frontend"
	@echo "  make test           Run Go tests and verify the frontend build"
	@echo "  make clean          Remove generated build output"

setup:
	$(GO) mod tidy
	cd $(WEB_DIR) && $(NPM) install

deps: setup

backend:
	$(GO) run $(APP_PATH)

frontend:
	cd $(WEB_DIR) && $(NPM) run dev -- --host 0.0.0.0

# Development mode. Both processes are stopped when make exits or Ctrl+C is pressed.
dev: setup
	@set -e; \
	$(GO) run $(APP_PATH) & backend_pid=$$!; \
	(cd $(WEB_DIR) && $(NPM) run dev -- --host 0.0.0.0) & frontend_pid=$$!; \
	trap 'kill $$backend_pid $$frontend_pid 2>/dev/null || true' EXIT INT TERM; \
	wait

frontend-build:
	cd $(WEB_DIR) && $(NPM) run build
	rm -rf $(WEB_DIST_DIR)
	mkdir -p $(WEB_DIST_DIR)
	cp -R $(WEB_BUILD_DIR)/. $(WEB_DIST_DIR)/

backend-build:
	mkdir -p $(BUILD_PATH)
	CGO_ENABLED=0 $(GO) build $(GO_FLAGS) -o $(BUILD_PATH)/$(APP_NAME) $(APP_PATH)

build: setup frontend-build backend-build
	@echo ""
	@echo "Build complete:"
	@echo "  backend: $(BUILD_PATH)/$(APP_NAME)"
	@echo "  frontend: $(WEB_DIST_DIR)"

# Runs the built Go binary and Vite's preview server together.
# Frontend: http://localhost:4173
# Backend:  http://localhost:8080
start: build
	@set -e; \
	./$(BUILD_PATH)/$(APP_NAME) & backend_pid=$$!; \
	(cd $(WEB_DIR) && $(NPM) run preview -- --host 0.0.0.0) & frontend_pid=$$!; \
	trap 'kill $$backend_pid $$frontend_pid 2>/dev/null || true' EXIT INT TERM; \
	wait

test: setup
	$(GO) test ./...
	cd $(WEB_DIR) && $(NPM) run build

clean:
	rm -rf $(BUILD_PATH) $(WEB_BUILD_DIR)
