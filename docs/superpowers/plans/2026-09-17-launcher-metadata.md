# Launcher Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage `.home-game` block with generic game-owned launcher help, keyboard/touch control hints, and a bottom-anchored Start action.

**Architecture:** Each game exports a tiny static `launcher.js` manifest containing rule/help keys and optional control keycaps. A central registry exposes metadata by game id. The homepage renders the selected manifest generically with Svelte 5 runes; it does not own per-game help text.

**Tech Stack:** Svelte 5 runes, JavaScript, Vitest/npm test, shared i18n dictionaries.

**Spec:** `docs/superpowers/specs/2026-09-17-launcher-metadata-design.md`

## Global Constraints

- Delete the `.home-game` DOM block and corresponding CSS completely.
- Keep setup controls at the top, help/controls in the middle, Join above Start, and Start as the bottom-most desktop action.
- Each game owns launcher presentation metadata; authoritative gameplay rules remain elsewhere.
- Keyboard controls render as generic keycaps/symbols such as `W`, `A`, `S`, `D`, `↑`, `↓`, `←`, `→`, `Space`, and `E`.
- Keep Svelte 5 runes; do not add legacy `$:` statements.
- Keep the borderless/full-bleed hero preview and black-hole fallback unchanged.
- Do not add GitHub CI.

---

### Task 1: Add game launcher manifests and registry

**Files:**
- Create: `web/src/lib/games/gomoku/launcher.js`
- Create: `web/src/lib/games/chess/launcher.js`
- Create: `web/src/lib/games/tetris/launcher.js`
- Create: `web/src/lib/games/snake/launcher.js`
- Create: `web/src/lib/games/drawguess/launcher.js`
- Create: `web/src/lib/games/dungeon/launcher.js`
- Create: `web/src/lib/games/launcher-registry.js`
- Test: `web/src/lib/games/launcher-registry.test.js`

**Interfaces:**
- Produces: `getLauncherMetadata(gameId)` returning `{ id, howToPlay, controls, tip }`.
- `controls` entries use `{ keys: string[], label: string }`.
- Unknown ids return `{ id: '', howToPlay: [], controls: [], tip: '' }`.

- [ ] **Step 1: Write registry tests**

Test all six known ids, 2–4 rule items per game, unknown fallback behavior, and preservation of tokens such as `['←','↓','→']`, `['Space']`, and `['W','A','S','D']`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cd web
npm test -- launcher-registry.test.js
```

Expected: FAIL because registry/manifests do not exist yet.

- [ ] **Step 3: Add minimal manifests**

Use the exact content from the spec. Examples:

```js
export const launcher = {
  id: 'tetris',
  howToPlay: [
    'game.tetris.launcher.move',
    'game.tetris.launcher.fill',
    'game.tetris.launcher.clear',
  ],
  controls: [
    { keys: ['←', '→'], label: 'game.tetris.launcher.controlMove' },
    { keys: ['↓'], label: 'game.tetris.launcher.controlSoftDrop' },
    { keys: ['↑'], label: 'game.tetris.launcher.controlRotate' },
    { keys: ['Space'], label: 'game.tetris.launcher.controlHardDrop' },
  ],
  tip: 'game.tetris.launcher.tip',
}
```

- [ ] **Step 4: Add the registry**

```js
const EMPTY = Object.freeze({ id: '', howToPlay: [], controls: [], tip: '' })

export function getLauncherMetadata(gameId) {
  return registry[gameId] ?? EMPTY
}
```

- [ ] **Step 5: Run focused tests again**

Expected: PASS.

---

### Task 2: Add bilingual launcher copy

**Files:**
- Modify: `web/src/lib/i18n.js`
- Test: `web/src/lib/games/launcher-registry.test.js`

**Interfaces:**
- Consumes: manifest i18n keys from Task 1.
- Produces: English and `zh-CN` strings for rule text, control labels, `HOW TO PLAY`, `CONTROLS`, and `TIP` section headings.

- [ ] **Step 1: Extend tests to resolve every manifest key in both locales**

For each manifest, create English and Chinese translators and assert every `howToPlay`, control `label`, and optional `tip` resolves to a non-empty value different from the raw key.

- [ ] **Step 2: Run focused test and verify new assertions fail**

- [ ] **Step 3: Add all translations**

Keep lines short and child-readable. Example:

```js
'game.snake.launcher.move': 'Move your snake around the arena.',
'game.snake.launcher.eat': 'Eat food to grow.',
'game.snake.launcher.avoid': 'Do not hit walls or another snake.',
'game.snake.launcher.controlMove': 'Move',
```

Chinese equivalent:

```js
'game.snake.launcher.move': '控制蛇在场地里移动。',
'game.snake.launcher.eat': '吃掉食物让自己变长。',
'game.snake.launcher.avoid': '不要撞墙或撞到其他蛇。',
'game.snake.launcher.controlMove': '移动',
```

- [ ] **Step 4: Run focused tests again**

Expected: PASS.

---

### Task 3: Add a reusable launcher-help renderer with keycaps

**Files:**
- Create: `web/src/lib/components/LauncherHelp.svelte`

**Interfaces:**
- Props: `{ metadata, t }` via `$props()`.
- Renders rule bullets, optional controls, optional tip.
- Each control token renders inside a semantic visual keycap (`<kbd>`).

- [ ] **Step 1: Implement the component using Svelte 5 props**

Structure:

```svelte
<script>
  let { metadata, t } = $props()
</script>

<section class="setup-help">
  <div class="help-block">
    <span class="help-label">{t('home.howToPlay')}</span>
    <ul>
      {#each metadata.howToPlay as key}
        <li>{t(key)}</li>
      {/each}
    </ul>
  </div>

  {#if metadata.controls?.length}
    <div class="help-block controls-block">
      <span class="help-label">{t('home.controls')}</span>
      {#each metadata.controls as control}
        <div class="control-row">
          <div class="keycaps">
            {#each control.keys as key}<kbd>{key}</kbd>{/each}
          </div>
          <span>{t(control.label)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if metadata.tip}
    <div class="help-block tip-block">
      <span class="help-label">{t('home.tip')}</span>
      <p>{t(metadata.tip)}</p>
    </div>
  {/if}
</section>
```

- [ ] **Step 2: Style keycaps compactly**

Use neutral dark keycaps with 1px muted borders, mono font, minimum 24–28px height, and no game-specific colors/CSS.

---

### Task 4: Refactor homepage right column

**Files:**
- Modify: `web/src/routes/+page.svelte`
- Modify or delete only if no longer used: `web/src/lib/home/game-copy.js`
- Test: existing `web/src/lib/home/game-copy.test.js` only if helper remains relevant.

**Interfaces:**
- Consumes: `getLauncherMetadata(game)` and `LauncherHelp`.
- Keeps existing `game`, `players`, `chessDifficulty`, room creation and join logic.

- [ ] **Step 1: Add selected metadata as a Svelte 5 derived value**

```js
const launcherMetadata = $derived(getLauncherMetadata(game))
```

- [ ] **Step 2: Delete `.home-game` markup completely**

There must be no `.home-game`, `.home-game-copy`, or `.game-index` DOM left.

- [ ] **Step 3: Reorder right-column markup**

Final order:

```text
GAME SETUP
setup controls
LauncherHelp
join-room block (when supported)
START GAME
helper only if it still adds non-duplicative setup information
```

The Start button must be physically after Join in the DOM so it is also the last visual action.

- [ ] **Step 4: Rebuild the right-column CSS**

Desktop:

```css
.setup {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.setup-help {
  margin-top: 22px;
}

.setup-actions {
  margin-top: auto;
}
```

Do not change the center preview in this task.

- [ ] **Step 5: Remove obsolete `.home-game*` CSS**

Search the file and ensure no `.home-game` selector remains.

---

### Task 5: Verification and regression review

**Files:**
- No CI files.

- [ ] **Step 1: Static review**

Confirm:

- no `.home-game` markup or CSS remains
- no legacy `$:` is introduced
- every known game has a manifest
- keyboard tokens stay presentation-only
- Start is after Join in DOM and bottom-anchored on desktop
- black-hole fallback and borderless center hero are unchanged

- [ ] **Step 2: User-run tests**

```bash
cd web
npm test
npm run build
```

- [ ] **Step 3: Manual UI checks**

At 1280×800, iPad landscape/portrait, and phone widths:

- switch through all six games
- verify rules and controls change immediately
- verify Tetris arrows/Space, Snake WASD/arrows, Dungeon WASD/Space/E render as readable keycaps
- verify EN/中文 updates help/control labels live
- verify Join stays above Start
- verify Start is the bottom-most desktop action
