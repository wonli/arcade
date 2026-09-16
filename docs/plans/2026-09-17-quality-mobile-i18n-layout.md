# Arcade quality, mobile, i18n and launcher plan

## Goal

Improve the existing arcade without a framework rewrite: add English/Chinese UI support with English as the default, make keyboard-only games usable on touch devices, expand Draw & Guess word content, and keep the launcher usable within a 13-inch desktop viewport as more games are added.

## Constraints

- Keep existing routes and game protocols compatible unless a language field is required.
- Prefer small shared utilities over new dependencies.
- Preserve desktop keyboard controls.
- Treat 1280x800 as the minimum desktop launcher target.
- Treat iPad and 390x844 mobile layouts as first-class responsive targets.
- Draw & Guess English and Chinese word banks must each contain at least 100 unique, non-empty entries in separate files.

## Tasks

### 1. Establish language primitives

- Add a small shared Svelte/JS i18n module with `en` and `zh` dictionaries.
- Default to English, persist explicit selection in localStorage, and fall back to English for missing keys.
- Add Node tests for default/fallback/locale normalization behavior.
- Add a compact language switcher at the app shell/launcher level and pass/use the selected locale in game UI.

### 2. Make launcher dense and scalable

- Replace the tall game cards with a compact responsive game selector.
- Keep selected-game summary, mode/difficulty controls, primary start action and join controls within the first 1280x800 viewport.
- Use a desktop split/grid layout and collapse cleanly for tablet/mobile.
- Translate launcher labels, descriptions, controls and accessible labels.

### 3. Add shared touch input helpers

- Add a small pointer/swipe direction helper with tests.
- Preserve keyboard handling and route keyboard/touch through the same game command functions.
- Use `touch-action` and non-passive pointer handling where gameplay must not scroll the page.

### 4. Snake mobile controls

- Add swipe controls on the arena board.
- Add an on-screen directional pad with large touch targets for tablet/mobile.
- Route all directions through one `sendDirection` function.
- Translate visible Snake status/action labels.

### 5. Tetris mobile controls

- Add on-screen left/right/rotate/soft-drop/hard-drop controls.
- Route keyboard and pointer controls through one action dispatcher.
- Keep controls reachable below/alongside the board without breaking desktop layout.
- Translate visible Tetris labels/status/actions.

### 6. Draw & Guess word banks and language

- Move English and Chinese words into separate Go files under `game/drawguess`.
- Add at least 100 unique non-empty entries to each bank.
- Add Go tests validating size, uniqueness and non-empty entries.
- Add locale to Draw & Guess room creation/start state so the selected UI language chooses the matching word bank while retaining English fallback.
- Translate visible Draw & Guess UI labels.

### 7. Room shell coverage

- Translate common room/loading/error/action copy that surrounds the game components.
- Ensure responsive containers do not force horizontal overflow on tablet/mobile.

### 8. Verification

- Run `go test ./...`.
- Run frontend tests (`npm test` / repository test script) and production build from `web`.
- Review branch diff for accidental protocol or layout regressions.
- Check launcher CSS against 1280x800, 1440x900, 1024x1366 portrait/landscape and 390x844 breakpoints by code/layout inspection; record that physical-device browser testing is still required unless CI/browser infrastructure exists.
