# SvelteKit Static Frontend Design

## Goal

Make AQI Arcade use clean URLs, prerender the fixed landing page, keep dynamic room URLs, reuse the shared WebSocket base library, and still ship as one embedded Go binary.

## Routing

- `/` is a prerendered SvelteKit page.
- `/room/[code]` is a dynamic client-rendered page because room codes are created at runtime and cannot be enumerated during build.
- Browser navigation uses the History API and normal links; hash routing is removed.
- Direct requests and refreshes for `/room/<code>` are served by the Go embedded frontend fallback.

## Build

- Migrate `web/` from plain Svelte + Vite to SvelteKit.
- Use `@sveltejs/adapter-static` with a fallback document for dynamic room routes.
- Static output is written into `internal/frontend/dist` before the Go binary is built.
- The root page is prerendered into a concrete HTML document.
- Generated assets remain untracked; the final Go executable embeds them with `go:embed`.

## Go frontend serving

- `/health` and `/ws` remain explicit Gin routes and never go through frontend resolution.
- Existing real files are served directly from the embedded filesystem.
- Missing `/assets/*` requests return 404.
- `/room/*` may fall back to the generated SvelteKit fallback document so dynamic room URLs survive refreshes.
- Unknown unrelated routes return 404 rather than being masked by the app shell.

## WebSocket client

- Keep `web/src/lib/ws/wslib.ts` as the low-level transport implementation.
- Do not use the committed `wsclient.ts` as-is because it imports modules from another SvelteKit project (`$lib/api/...`).
- Add a small Arcade-specific adapter that exposes Promise-based request/response and topic subscription semantics needed by the room UI.
- The adapter connects to same-origin `/ws` and surfaces connection state/errors to the room page.

## UI

The landing page is intentionally minimal:

- AQI Arcade brand/title.
- One playable game: Gomoku.
- Primary `Create room` action.
- Six-character room code field plus `Join` action.
- No future-game cabinet, realtime status badge, marketing paragraphs, or decorative footer copy.

The room page keeps only gameplay-relevant information:

- Room code and invite copy action.
- Black/white players.
- Current turn / waiting / winner state.
- Gomoku board.
- Connection/error recovery when needed.

Developer-facing labels such as `FULL STATE` and `SERVER AUTHORITATIVE` are removed from the primary UI.

## Constraints

- One distributable Go binary.
- Default runtime remains one process on port 8080.
- Clean URLs; no hash router.
- Root page must be prerendered.
- Dynamic room codes must remain runtime-capable without pre-enumeration.
- Missing assets must fail with 404.
- Preserve AQI action names and server protocol.
