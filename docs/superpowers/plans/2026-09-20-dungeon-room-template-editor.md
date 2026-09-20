# Dungeon Room Template Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a separate Dungeon3 room-template editor that starts from an empty valid room grid, exposes the real Dungeon3 assets, records the user's exact placements as versioned JSON, and leaves the future generator with a stable template/port contract.

**Architecture:** Keep `/dungeon/editor` unchanged because it is the existing weapon/VFX sandbox. Add pure room-template model, asset-catalog, and editor-state modules, then a Svelte `/dungeon/room-editor` route that renders a native 16px grid and palette without adding a UI dependency. The first slice exports/imports authored templates; procedural generation is not changed until the authored template format has been validated.

**Tech Stack:** SvelteKit/Svelte, native browser pointer events, existing `dungeon3Rules` generated from `Dungeon3.tmx`, Node built-in test runner, existing Vite build.

**Spec:** `docs/superpowers/specs/2026-09-20-dungeon-room-template-editor-design.md`

## Global Constraints

- Do not modify or replace the existing `/dungeon/editor` weapon/VFX route.
- Use only existing Dungeon3 assets and references; do not generate new PNG resources.
- Store native `tileSize: 16` coordinates and exact `tileset/tileId/flip` references in exported JSON.
- Do not modify `map-generator.js` in this first implementation slice.
- Do not add runtime dependencies.
- Do not stage or commit the pre-existing dirty Dungeon3 wall changes while implementing this editor.

## Review Focus

- An asset from a different tileset or an out-of-range tile ID must be rejected with a field-specific validation error; test in Task 1.
- A multi-cell motif placed near an edge must be rejected atomically rather than partially painted; test in Task 2.
- A west/east port or wall asset must preserve its authored direction and must not be mirrored implicitly; test in Task 2.
- Import/export must preserve exact source references and semantic kinds across a round trip; test in Task 1.
- A bridge, door, or stair port with incompatible water/level metadata must be rejected before export; test in Task 1.

### Task 1: Define and validate the room-template contract

**Files:**
- Create: `web/src/lib/games/dungeon/room-template.js`
- Create: `web/src/lib/games/dungeon/room-template.test.js`
- Modify: `docs/superpowers/specs/2026-09-20-dungeon-room-template-editor-design.md` only if an implementation-level ambiguity is discovered

**Interfaces:**
- Produces `createEmptyRoomTemplate(options)`, `normalizeRoomTemplate(value)`, `validateRoomTemplate(template)`, `serializeRoomTemplate(template)`, and `parseRoomTemplate(text)`.
- `validateRoomTemplate` returns `{ valid: true, value }` or `{ valid: false, errors: [{ path, message }] }` and never silently drops authored visual references.

- [ ] **Step 1: Write the failing tests**

  Add tests proving that `createEmptyRoomTemplate({ id: 'test-room', width: 12, height: 10 })` creates exactly `schema: 'dungeon3-room-template'`, `version: 1`, native 16px grid dimensions, empty authored layers, and no invented walls. Add a round-trip test for a template containing a semantic asset key, exact source cells, a water cell, a door port, and an arch bridge feature. Add invalid cases for an unknown tileset, out-of-range tile ID, off-grid cell, water bridge with no water, and a cross-level door.

- [ ] **Step 2: Run the focused test to verify it fails**

  Run: `node --test src/lib/games/dungeon/room-template.test.js`

  Expected: FAIL because the module and contract functions do not exist yet.

- [ ] **Step 3: Implement the minimal pure model**

  Implement the schema constructors and strict validation. Keep logical terrain cells separate from visual `source` refs. Normalize missing optional arrays to empty arrays, reject unknown schema/version, validate every source ref against `dungeon3Rules.tilesets`, and validate port edge/level/water rules without deriving or inventing wall geometry.

- [ ] **Step 4: Run the focused test to verify it passes**

  Run: `node --test src/lib/games/dungeon/room-template.test.js`

  Expected: PASS with all validation and round-trip assertions.

- [ ] **Step 5: Commit only the new contract files**

  Run: `git add web/src/lib/games/dungeon/room-template.js web/src/lib/games/dungeon/room-template.test.js && git commit -m "feat: add Dungeon3 room template contract"`

### Task 2: Expose a complete Dungeon3 asset catalog and editor operations

**Files:**
- Create: `web/src/lib/games/dungeon/room-template-assets.js`
- Create: `web/src/lib/games/dungeon/room-template-assets.test.js`
- Create: `web/src/lib/games/dungeon/room-template-editor.js`
- Create: `web/src/lib/games/dungeon/room-template-editor.test.js`

**Interfaces:**
- `listDungeon3RoomAssets()` returns palette entries with `{ key, label, kind, width, height, image, columns, cells, allowedRotations, semantic }`.
- `createRoomEditorState(template)` returns `{ template, selectedAsset, selectedTool, errors }`.
- `placeAsset(state, asset, x, y, options)` returns a new state or `{ ...state, errors }` without partial writes.
- `eraseAt(state, x, y)`, `setCellKind(state, x, y, kind)`, and `placePort(state, port)` return new immutable states.

- [ ] **Step 1: Write the failing asset-catalog and operation tests**

  Assert that the catalog contains the actual extracted wall west/east/body assemblies, horizontal wall, door/door-open, water, stairs, flat bridge deck, and `Arches_columns` arch bridge. Assert that every catalog entry's source cells resolve to a real `dungeon3Rules` tileset. Add a test that placing a 2x3 motif at the final grid column returns a validation error and leaves the template unchanged. Add tests proving erase, water painting, port placement, and explicit west/east rotations preserve exact `flip` and `rotation` metadata.

- [ ] **Step 2: Run the focused tests to verify they fail**

  Run: `node --test src/lib/games/dungeon/room-template-assets.test.js src/lib/games/dungeon/room-template-editor.test.js`

  Expected: FAIL because the catalog and immutable editor operations do not exist.

- [ ] **Step 3: Implement the catalog from `dungeon3Rules`**

  Build palette entries from generated rule assemblies/motifs rather than duplicating tile IDs in the UI. Include the source image URL derived from the existing Dungeon3 tileset metadata, the authored motif footprint, and an explicit `allowedRotations` list; do not infer that west/east can be mirrored.

- [ ] **Step 4: Implement immutable editor operations**

  Use `normalizeRoomTemplate` and `validateRoomTemplate` after each operation. Stamp all cells of a motif atomically, attach semantic metadata to the feature/port record, and reject invalid placements without mutating the previous state. Keep all operations DOM-independent so they can be tested and reused by the route.

- [ ] **Step 5: Run the focused tests to verify they pass**

  Run: `node --test src/lib/games/dungeon/room-template-assets.test.js src/lib/games/dungeon/room-template-editor.test.js`

  Expected: PASS with complete catalog coverage and atomic editor operations.

- [ ] **Step 6: Commit the catalog and state layer**

  Run: `git add web/src/lib/games/dungeon/room-template-assets.js web/src/lib/games/dungeon/room-template-assets.test.js web/src/lib/games/dungeon/room-template-editor.js web/src/lib/games/dungeon/room-template-editor.test.js && git commit -m "feat: add Dungeon3 room editor asset palette"`

### Task 3: Build the visual room editor route

**Files:**
- Create: `web/src/routes/dungeon/room-editor/+page.svelte`
- Create: `web/src/lib/games/dungeon/room-editor-route.test.js`

**Interfaces:**
- The route imports only `room-template`, `room-template-assets`, and `room-template-editor` for editing; it does not import or alter the existing weapon editor runtime.
- UI actions are `New room`, `Import JSON`, `Export JSON`, `Undo`, `Redo`, `select palette asset`, `paint cell`, `erase`, `add port`, and `validate`.

- [ ] **Step 1: Write the failing route-contract tests**

  Read the route source in a Node test and assert that the new route imports the room-template modules, exposes `Export JSON` and `Import JSON` controls, renders a native-grid room surface, and does not import `editor-runtime.js` or the existing weapon presentation config. Add a pure helper assertion for palette image URLs coming from Dungeon3 metadata.

- [ ] **Step 2: Run the route-contract test to verify it fails**

  Run: `node --test src/lib/games/dungeon/room-editor-route.test.js`

  Expected: FAIL because the new route does not exist.

- [ ] **Step 3: Implement the route UI**

  Create a responsive editor with a left palette grouped by terrain/wall/door/bridge/stairs/object, a center native-grid room surface, and a right inspector showing template ID, dimensions, selected asset source, ports, validation errors, and JSON actions. Use pointer events on grid cells and CSS sprite previews backed by the existing Dungeon3 images. Start every new room as a valid empty floor grid with no guessed wall/door artwork. Keep all edits in the pure editor state module.

- [ ] **Step 4: Implement import/export and history**

  Export `serializeRoomTemplate(state.template)` as `dungeon3-room-<id>.json` through a browser download. Import through a file input, call `parseRoomTemplate`, replace state only after validation, and display field-specific errors. Keep a bounded undo/redo stack of template snapshots; do not use localStorage as the canonical source.

- [ ] **Step 5: Run route contract tests and build**

  Run: `node --test src/lib/games/dungeon/room-editor-route.test.js && npm run build`

  Expected: PASS and a successful SvelteKit/Vite production build.

- [ ] **Step 6: Commit only the editor route and route test**

  Run: `git add web/src/routes/dungeon/room-editor/+page.svelte web/src/lib/games/dungeon/room-editor-route.test.js && git commit -m "feat: add Dungeon3 room template editor"`

### Task 4: Browser verification and repository regression checks

**Files:**
- Modify: none unless a test exposes a defect in the new editor
- Test: existing Dungeon3 tests plus the new room-template tests

**Interfaces:**
- Browser target: `http://localhost:5173/dungeon/room-editor`.
- The verification uses the existing Vite dev server and checks the actual rendered editor, not only source assertions.

- [ ] **Step 1: Start or reuse the Vite server and open the new route**

  Use the existing server on port 5173. Navigate the in-app browser to `/dungeon/room-editor` and capture the initial empty room, palette, and inspector.

- [ ] **Step 2: Exercise the authored-resource workflow**

  Select a west wall, east wall, door, water cell, flat bridge, and `Arches_columns` arch entry. Place them in valid and invalid positions. Confirm invalid placements are rejected visibly, valid placements remain aligned to 16px cells, and exported JSON contains the exact selected tileset/tile IDs.

- [ ] **Step 3: Verify import/export round trip in the browser**

  Export a room, import the downloaded JSON, and confirm the room and validation state are unchanged. Capture a screenshot for visual review.

- [ ] **Step 4: Run the complete repository checks**

  Run from `web/`: `npm test` and `npm run build`.

  Expected: all existing tests pass, including the unchanged `/dungeon/editor` contract, and the build succeeds.

- [ ] **Step 5: Review the diff and report remaining integration boundary**

  Run: `git status --short` and `git diff --stat HEAD~3..HEAD` while keeping pre-existing Dungeon3 changes out of the editor commits. Report that generator consumption remains the next separate task until authored JSON has been reviewed in the browser.

