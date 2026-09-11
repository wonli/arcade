# Embedded Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Svelte frontend into the Go executable and run AQI Arcade from one process and one port.

**Architecture:** Vite writes production assets to `internal/frontend/dist`. Package `internal/frontend` embeds that directory and exposes a Gin-compatible SPA handler. The existing AQI server keeps `/health` and `/ws` explicit, then delegates frontend routes to the embedded filesystem.

**Tech Stack:** Go 1.27, `embed`, `io/fs`, Gin, Svelte 5, Vite, Make

**Spec:** `docs/superpowers/specs/2026-09-11-embedded-frontend-design.md`

## Global Constraints

- Final distributable is one Go executable.
- Runtime uses one origin and one port: `http://localhost:8080` by default.
- `/health` and `/ws` must keep their existing behavior.
- Frontend source remains in `web/`.
- Default README path must not require running Vite separately.

---

### Task 1: Embedded SPA filesystem

**Files:**
- Create: `internal/frontend/frontend.go`
- Create: `internal/frontend/frontend_test.go`
- Create during build: `internal/frontend/dist/*`

**Interfaces:**
- Produces: `frontend.Register(engine *gin.Engine)`

- [ ] Write tests for root asset serving, static asset serving, and SPA fallback.
- [ ] Run Go tests and confirm the new package fails before implementation.
- [ ] Implement the embedded filesystem and Gin fallback handler.
- [ ] Run Go tests and confirm they pass.

### Task 2: Server integration

**Files:**
- Modify: `cmd/arcade/main.go`

**Interfaces:**
- Consumes: `frontend.Register(engine *gin.Engine)`

- [ ] Register `/health` and `/ws` before frontend fallback.
- [ ] Register embedded frontend routes on the existing Gin engine.
- [ ] Run `go test ./...`.

### Task 3: Single-binary Make workflow

**Files:**
- Modify: `web/vite.config.js`
- Modify: `Makefile`

- [ ] Change Vite production output to `../internal/frontend/dist`.
- [ ] Make `frontend` install/build the web project.
- [ ] Make `build` build frontend first, then `dist/arcade`.
- [ ] Make `start` run only `./dist/arcade`.
- [ ] Make `dev` build frontend then run only the Go server.
- [ ] Remove preview-server runtime behavior.

### Task 4: Documentation and CI verification

**Files:**
- Modify: `README.md`
- Modify if needed: `.github/workflows/ci.yml`

- [ ] Put `make start` and `http://localhost:8080` in the quick-start path.
- [ ] Document `make dev`, `make build`, and frontend-only Vite workflow separately.
- [ ] Run `make test`.
- [ ] Run `make build` and verify the final Go executable contains the frontend build.
- [ ] Run CI and inspect the final result before claiming completion.
