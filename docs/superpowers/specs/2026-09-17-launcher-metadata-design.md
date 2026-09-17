# Launcher Metadata & Setup Panel Design

Date: 2026-09-17
Branch: `feat/quality-mobile-i18n-layout`

## Goal

Refactor the Arcade home launcher so the right column has one clear job: explain how to start and play the selected game, then provide the Start action at the bottom.

Remove the current `home-game` title/description block entirely. Game-specific launcher help must come from metadata owned by each game instead of being hard-coded into the homepage.

## UX Structure

Desktop right column:

```text
GAME SETUP

[ player / mode controls ]
[ difficulty controls when relevant ]

HOW TO PLAY
• short instruction
• short instruction
• short instruction

TIP
short optional hint

<flexible empty space>

[ START GAME ]
```

Rules:

- The selected game name is not repeated in the setup panel; it already exists in the game list and hero preview.
- The removed `.home-game` block must not be replaced by another title/description card.
- Setup controls stay at the top.
- Help content occupies the middle.
- The primary Start button is always the last visual action at the bottom of the right column on desktop.
- Join-room UI, when available, sits above the Start button so Start remains the bottom-most primary action.
- Copy must be short enough that a child can understand what to do without reading a paragraph.
- The center hero preview remains borderless/full-bleed with the black-hole fallback introduced in the previous change.

## Information Architecture

The three homepage columns have distinct responsibilities:

- Left: choose a game.
- Center: understand what the game looks/feels like through the latest gameplay screenshot or fallback hero image.
- Right: configure the game, learn the basic rules, and start.

The homepage must not own game-specific rule text.

## Launcher Metadata Ownership

Each game owns a small launcher manifest next to its game implementation.

Recommended layout:

```text
web/src/lib/games/
├── gomoku/
│   └── launcher.js
├── chess/
│   └── launcher.js
├── tetris/
│   └── launcher.js
├── snake/
│   └── launcher.js
├── drawguess/
│   └── launcher.js
└── dungeon/
    └── launcher.js
```

Each module exports static launcher metadata. Example:

```js
export const launcher = {
  id: 'gomoku',
  howToPlay: [
    'game.gomoku.launcher.place',
    'game.gomoku.launcher.five',
    'game.gomoku.launcher.block',
  ],
  tip: 'game.gomoku.launcher.tip',
}
```

The metadata is intentionally small. It is not a general game configuration system.

## Metadata Contract

Required:

- `id`: stable game id.
- `howToPlay`: array of 2–4 i18n keys.

Optional:

- `tip`: one i18n key.
- `controls`: short control hints when useful.
- `audienceHint`: only if a game genuinely needs a launcher-specific hint.

The following do **not** belong in launcher metadata:

- live room/player state
- screenshots or image URLs
- colors or CSS
- API endpoints
- current scores
- server state
- runtime game rules used for authoritative gameplay

Launcher metadata is presentation guidance only.

## Registry

Create one small registry module that imports each game launcher manifest and exposes lookup by game id.

Example responsibility:

```text
getLauncherMetadata('gomoku')
  -> gomoku launcher manifest
```

The homepage consumes the registry and stays generic.

Adding another game should require adding its launcher manifest and registry entry, not adding another chain of `if (game === ...)` rule-copy branches to `+page.svelte`.

## i18n

All launcher rule copy remains in the shared i18n dictionaries so language switching stays instant and consistent.

Example English copy:

```text
HOW TO PLAY
• Tap an empty spot
• Make 5 stones in a row
• Stop your friend from making 5
```

Example Chinese copy:

```text
怎么玩
• 点击空位置放棋子
• 先连成 5 个就赢
• 别让对方先连成 5 个
```

Guidelines:

- one action per line
- plain verbs
- no long game-history explanations
- avoid terminology a child would need explained
- English remains the default locale

## Initial Game Copy

### Gomoku

English:
- Tap an empty spot.
- Make 5 stones in a row.
- Stop your friend from making 5 first.

Chinese:
- 点击空位置放棋子。
- 先连成 5 个就赢。
- 别让对方先连成 5 个。

### Chess

English:
- Move one piece each turn.
- Protect your king.
- Checkmate the other king.

Chinese:
- 每回合移动一个棋子。
- 保护好自己的王。
- 将死对方的王就获胜。

### Tetris

English:
- Move and rotate the blocks.
- Fill a complete row.
- Clear rows to score and stay alive.

Chinese:
- 移动并旋转方块。
- 填满完整的一行。
- 消除更多行并坚持下去。

### Snake

English:
- Move your snake around the arena.
- Eat food to grow.
- Do not hit walls or another snake.

Chinese:
- 控制蛇在场地里移动。
- 吃掉食物让自己变长。
- 不要撞墙或撞到其他蛇。

### Draw & Guess

English:
- One player draws the secret word.
- Everyone else types a guess.
- Guess correctly before time runs out.

Chinese:
- 一个人根据秘密词语画画。
- 其他人输入自己的答案。
- 在时间结束前猜对它。

### Dungeon

English:
- Move through the dungeon.
- Fight enemies and collect better gear.
- Go deeper and survive as long as you can.

Chinese:
- 在地牢中探索移动。
- 打败敌人并获得更好的装备。
- 不断深入并尽量活得更久。

## Homepage Component Changes

`web/src/routes/+page.svelte`:

- delete the `.home-game` DOM block completely
- remove its corresponding CSS
- use the selected game's launcher metadata from the registry
- render generic Setup, How to Play, Tip/Controls, Join, and Start sections
- keep Svelte 5 runes (`$state`, `$derived`, `$effect` where needed); do not reintroduce legacy `$:` statements
- keep existing room creation and joining behavior

The current `gameCopy()` helper may remain only for labels that truly depend on game/mode if still useful, but it must no longer be the source of the removed right-column title/description block.

## Right Column Layout

Desktop implementation intent:

```css
.setup {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.setup-help {
  /* normal content flow in the middle */
}

.setup-actions {
  margin-top: auto;
}
```

The exact selectors may differ, but behavior must be:

1. setup controls at top
2. rules/tip in middle
3. join UI above Start when present
4. Start button at the absolute visual bottom of the right column

On tablet/mobile, the column may stack naturally and Start does not need to be viewport-fixed.

## Error/Fallback Behavior

- Missing metadata for an unknown game must return a safe empty manifest instead of crashing the homepage.
- Missing `tip` simply hides the Tip block.
- Missing translation keys use the existing translator fallback behavior.
- Launcher metadata has no network dependency.

## Tests

Add frontend unit tests for:

- registry returns the correct manifest for every known game
- every known game has 2–4 `howToPlay` items
- unknown game returns safe fallback metadata
- English and Chinese rule keys resolve to non-empty strings
- changing selected game resolves different launcher metadata

Manual checks:

1. Select every game and verify the right-side rules change immediately.
2. Confirm `.home-game` no longer exists in the DOM.
3. Confirm the game name is not redundantly repeated in the setup panel.
4. Confirm the Start button is the lowest control in the desktop right column.
5. Confirm Join appears above Start for games that support joining.
6. Switch EN / 中文 and verify all help text changes immediately.
7. Verify the center hero preview and black-hole fallback are unchanged.
8. Check 1280×800, iPad landscape/portrait, and phone layouts.

## Verification

No GitHub CI changes.

User-run verification commands:

```bash
cd web
npm test
npm run build
```

## Non-goals

- Moving authoritative game rules to the frontend manifest
- Adding a backend `/api/games` metadata endpoint
- Making launcher metadata remotely editable
- Adding game screenshots to the manifest
- Redesigning the center preview again in this change
- Adding GitHub CI
