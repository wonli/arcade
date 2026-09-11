# Embedded Frontend Design

## Goal

Ship AQI Arcade as one Go binary that serves the built Svelte frontend, HTTP endpoints, and WebSocket endpoint from the same origin.

## Architecture

- Keep `web/` as the Svelte/Vite source project.
- Build Vite output directly into `internal/frontend/dist/`.
- Add `internal/frontend` as the only package responsible for embedding and serving frontend assets.
- The Go server keeps `/health` and `/ws` as explicit routes; every other GET is served from embedded assets, with SPA fallback to `index.html`.
- Browser WebSocket connections use same-origin `/ws`; no Vite preview proxy is needed for the distributable build.

## Developer and distribution flow

- `make frontend` installs frontend dependencies and builds embedded assets.
- `make build` runs the frontend build first, then compiles `dist/arcade`; `go:embed` packages the generated assets into that binary.
- `make start` builds and runs only `./dist/arcade`.
- `make dev` rebuilds the frontend once and runs the Go server on port 8080. Vite hot reload is intentionally not part of the default path; frontend-focused development can still run Vite manually when needed.
- README quick start points users at a single URL: `http://localhost:8080`.

## Testing

CI uses Makefile targets. Go tests cover frontend fallback behavior without depending on a live browser; `make build` proves generated frontend assets can be embedded into the final binary.
