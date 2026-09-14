# Dungeon Legendary Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 12 Boss-exclusive legendary swords rare, immediately overpowered, and able to grow with the player through the endless Dungeon up to Lv20.

**Architecture:** Keep the 12 weapon definitions and Boss selection in `legendary-weapons.js`, add a focused `legendary-growth.js` module for immutable base snapshots and deterministic materialization, and integrate growth only through the live `installInfiniteDungeon()` room-clear path. Existing `deriveEquipment()` remains the single player-stat derivation path; VFX and UI read the materialized legendary state instead of calculating power themselves.

**Tech Stack:** JavaScript ES modules, Node `node:test`, Svelte 5, Phaser 4 runtime.

**Spec:** `docs/superpowers/specs/2026-09-14-dungeon-legendary-growth-design.md`

## Global Constraints

- The live Dungeon progression path is `+page.svelte -> installInfiniteDungeon()`, not legacy five-floor completion code in `scene.js`.
- The 12 `sword_11.png` through `sword_22.png` weapons remain Boss-exclusive.
- Normal enemies, treasure chests, and Fortune cannot create Boss legendary swords.
- Boss legendary chance is exactly 5%; a miss returns the previous Rare/Epic Boss reward behavior.
- Legendary level starts at 1, caps at 20, and grows only after clearing combat-capable rooms while equipped.
- Rest and treasure rooms do not grant automatic growth.
- Legendary `temper` grants +1 legendary level instead of mutating an affix.
- Legendary power is always recalculated from immutable base snapshots; no repeated compounding.
- Legendary particle target sizes are 16/18/20/22/24 px at Lv1/Lv5/Lv10/Lv15/Lv20 and must remain source-texture-size normalized.
- Existing non-legendary loot, combat, infinite progression, and particle behavior must remain compatible.

---

### Task 1: Legendary Growth Core

**Files:**
- Create: `web/src/lib/games/dungeon/legendary-growth.js`
- Create: `web/src/lib/games/dungeon/legendary-growth.test.js`

**Interfaces:**
- Consumes: a normal weapon item object with `rarity`, `damage`, `affixes`, optional `legendaryLevel`, `legendaryBaseDamage`, `legendaryBaseAffixes`, and optional `signatureAffixes`.
- Produces: `isLegendaryWeapon(item)`, `legendaryAwakening(level)`, `normalizeLegendary(item)`, `materializeLegendary(item, level?)`, `growLegendary(item, levels?)`, and `legendaryVfxTarget(item)`.

- [ ] **Step 1: Write failing core tests**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  growLegendary,
  legendaryAwakening,
  legendaryVfxTarget,
  materializeLegendary,
  normalizeLegendary,
} from './legendary-growth.js'

const sample = {
  type: 'weapon.stormcrown',
  rarity: 'legendary',
  damage: 100,
  affixes: [
    { id: 'thunder', tier: 4, value: 0.85 },
    { id: 'chain', tier: 4, value: 0.80 },
  ],
  signatureAffixes: ['thunder', 'chain'],
}

test('legendary snapshots are immutable and same-level materialization is idempotent', () => {
  const normalized = normalizeLegendary(sample)
  const once = materializeLegendary(normalized, 10)
  const twice = materializeLegendary(once, 10)
  assert.equal(once.damage, twice.damage)
  assert.deepEqual(once.affixes, twice.affixes)
  assert.equal(once.legendaryBaseDamage, 100)
  assert.deepEqual(once.legendaryBaseAffixes, sample.affixes)
})

test('legendary growth has milestone awakenings and a hard Lv20 cap', () => {
  assert.equal(legendaryAwakening(1), 0)
  assert.equal(legendaryAwakening(5), 1)
  assert.equal(legendaryAwakening(10), 2)
  assert.equal(legendaryAwakening(15), 3)
  assert.equal(legendaryAwakening(20), 4)
  assert.equal(growLegendary({ ...sample, legendaryLevel: 20 }).legendaryLevel, 20)
})

test('legendary VFX targets stay pixel-sized by awakening', () => {
  assert.deepEqual([1, 5, 10, 15, 20].map((level) => legendaryVfxTarget({ rarity: 'legendary', legendaryLevel: level }).size), [16, 18, 20, 22, 24])
})
```

- [ ] **Step 2: Run tests and confirm RED**

Run:
```bash
node --test web/src/lib/games/dungeon/legendary-growth.test.js
```
Expected: FAIL because `legendary-growth.js` does not exist.

- [ ] **Step 3: Implement deterministic legendary materialization**

Create `legendary-growth.js` with these exact rules:

```js
const LEVEL_CAP = 20
const VFX_SIZES = [16, 18, 20, 22, 24]

const cloneAffixes = (affixes = []) => affixes.map((entry) => ({ ...entry }))
const levelOf = (value) => Math.max(1, Math.min(LEVEL_CAP, Math.floor(Number(value) || 1)))

export function isLegendaryWeapon(item) {
  return Boolean(item && item.rarity === 'legendary' && item.type?.startsWith?.('weapon.'))
}

export function legendaryAwakening(level = 1) {
  const next = levelOf(level)
  if (next >= 20) return 4
  if (next >= 15) return 3
  if (next >= 10) return 2
  if (next >= 5) return 1
  return 0
}

export function normalizeLegendary(item) {
  if (!isLegendaryWeapon(item)) return item
  return {
    ...item,
    legendaryLevel: levelOf(item.legendaryLevel),
    legendaryBaseDamage: Number.isFinite(item.legendaryBaseDamage) ? item.legendaryBaseDamage : (item.damage ?? 0),
    legendaryBaseAffixes: cloneAffixes(item.legendaryBaseAffixes ?? item.affixes),
    signatureAffixes: [...(item.signatureAffixes ?? [])],
  }
}

export function materializeLegendary(item, requestedLevel = item?.legendaryLevel ?? 1) {
  if (!isLegendaryWeapon(item)) return item
  const base = normalizeLegendary(item)
  const level = levelOf(requestedLevel)
  const awakening = legendaryAwakening(level)
  const damageMultiplier = 1 + 0.10 * (level - 1) + 0.20 * awakening
  const affixMultiplier = 1 + 0.025 * (level - 1) + 0.10 * awakening
  const signatures = new Set(base.signatureAffixes)
  const affixes = base.legendaryBaseAffixes.map((entry) => ({
    ...entry,
    value: Number(((entry.value ?? 0) * affixMultiplier * (signatures.has(entry.id) ? 1 + 0.08 * awakening : 1)).toFixed(3)),
  }))
  return { ...base, legendaryLevel: level, damage: Math.max(1, Math.round(base.legendaryBaseDamage * damageMultiplier)), affixes }
}

export function growLegendary(item, levels = 1) {
  if (!isLegendaryWeapon(item)) return item
  const base = normalizeLegendary(item)
  return materializeLegendary(base, levelOf(base.legendaryLevel + Math.max(0, Math.floor(levels || 0))))
}

export function legendaryVfxTarget(item) {
  const awakening = legendaryAwakening(item?.legendaryLevel ?? 1)
  return { size: VFX_SIZES[awakening], burst: Math.min(20, 12 + awakening * 2), quantity: 2 }
}
```

- [ ] **Step 4: Run core tests and confirm GREEN**

Run:
```bash
node --test web/src/lib/games/dungeon/legendary-growth.test.js
```
Expected: PASS.

### Task 2: Boss Drop Routing and Legendary Materialization

**Files:**
- Modify: `web/src/lib/games/dungeon/legendary-weapons.js`
- Modify: `web/src/lib/games/dungeon/legendary-weapons.test.js`
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`

**Interfaces:**
- Consumes: Task 1 `materializeLegendary()`.
- Produces: Lv1 Boss legendary items with immutable base snapshots; `bossReward()` with exactly 5% legendary chance and Rare/Epic fallback.

- [ ] **Step 1: Write failing drop tests**

Add tests asserting:

```js
test('Boss legendary chance is five percent and a miss falls back to normal Boss gear', () => {
  const legendary = bossReward(() => 0.049, 12)
  assert.equal(legendary.rarity, 'legendary')
  assert.equal(legendary.legendaryLevel, 1)

  const fallback = bossReward(() => 0.50, 12)
  assert.notEqual(fallback.rarity, 'legendary')
  assert.ok(['rare', 'epic'].includes(fallback.rarity))
})

test('all Boss legendary swords carry immutable base snapshots and signature identity', () => {
  for (const definition of LEGENDARY_WEAPON_CATALOG) {
    const item = materializeBossLegendary(definition, 12)
    assert.equal(item.rarity, 'legendary')
    assert.equal(item.legendaryLevel, 1)
    assert.ok(item.legendaryBaseDamage > 0)
    assert.equal(item.legendaryBaseAffixes.length, 4)
    assert.equal(item.signatureAffixes.length, 2)
  }
})
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run:
```bash
node --test web/src/lib/games/dungeon/legendary-weapons.test.js web/src/lib/games/dungeon/combat.test.js
```
Expected: FAIL because Boss currently always returns legendary and definitions do not expose growth metadata.

- [ ] **Step 3: Extend legendary definitions and materialization**

Add two signature-affix ids to every existing legendary definition. Implement `materializeBossLegendary(definition, floor)` using `materializeLegendary()` with a Lv1 base damage of:

```js
const depthBonus = Math.round(Math.max(0, Math.floor(floor || 1) - 1) * 1.35)
const legendaryBaseDamage = Math.round(definition.baseDamage * 2.6) + depthBonus
```

The returned item must include `legendaryBaseDamage`, cloned `legendaryBaseAffixes`, `signatureAffixes`, and `legendaryLevel: 1` before passing through `materializeLegendary()`.

- [ ] **Step 4: Restore Rare/Epic Boss fallback and put legendary in a 5% branch**

In `combat.js`, preserve the prior Boss reward calculation as a private `normalBossReward(random, floor)` helper. Implement:

```js
export function bossReward(random = Math.random, floor = 5) {
  const legendaryRoll = random()
  if (legendaryRoll < 0.05) return rollBossLegendary(floor, random)
  return normalBossReward(random, floor)
}
```

Keep normal `rollEquipment()`, chest generation, and Fortune promotion capped at Epic.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run:
```bash
node --test web/src/lib/games/dungeon/legendary-weapons.test.js web/src/lib/games/dungeon/combat.test.js
```
Expected: PASS.

### Task 3: Infinite-Runtime Growth and Rest Temper

**Files:**
- Modify: `web/src/lib/games/dungeon/infinite-runtime.js`
- Modify: `web/src/lib/games/dungeon/infinite-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/rest.js`
- Modify: `web/src/lib/games/dungeon/rest.test.js`

**Interfaces:**
- Consumes: Task 1 `growLegendary()` and `isLegendaryWeapon()`.
- Produces: one legendary level per cleared combat-capable room, and +1 legendary level for legendary `temper`.

- [ ] **Step 1: Add failing growth-trigger tests**

Test a pure helper exported from `infinite-runtime.js`:

```js
export function legendaryGrowthForRoom(playerState, roomRole) {}
```

Expected behavior:

```js
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'combat').equippedWeapon.legendaryLevel, 2)
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'elite').equippedWeapon.legendaryLevel, 2)
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'boss').equippedWeapon.legendaryLevel, 2)
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'antechamber').equippedWeapon.legendaryLevel, 2)
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'rest').equippedWeapon.legendaryLevel, 1)
assert.equal(legendaryGrowthForRoom(stateAtLv1, 'treasure').equippedWeapon.legendaryLevel, 1)
```

Also test that growth re-runs `deriveEquipment()` so `weaponDamage`, affixes, and total player damage update together.

- [ ] **Step 2: Run runtime/rest tests and confirm RED**

Run:
```bash
node --test web/src/lib/games/dungeon/infinite-runtime.test.js web/src/lib/games/dungeon/rest.test.js
```
Expected: FAIL because room-clear legendary growth and legendary temper do not exist.

- [ ] **Step 3: Implement pure room-growth helper and call it once on clear**

Implement `legendaryGrowthForRoom(playerState, roomRole)` with `new Set(['combat','elite','boss','antechamber'])`. If equipped weapon is legendary, call `growLegendary()` and then:

```js
return {
  ...deriveEquipment(playerState.baseStats, grownWeapon, playerState),
  baseStats: { ...playerState.baseStats },
}
```

In `scene.checkFloorClear`, after living-enemy count reaches zero and before opening the portal, replace `scene.playerState` with this helper result. Emit `legendarylevel` only when the level changed, including `{ level, awakening, weapon }`, then update HUD/stat observers through existing `scene.emitStats?.()`.

- [ ] **Step 4: Make legendary temper grant one level**

In `rest.js`, before normal `temperWeapon()` behavior:

```js
if (choice === 'temper' && isLegendaryWeapon(playerState?.equippedWeapon)) {
  const weapon = growLegendary(playerState.equippedWeapon)
  const baseStats = { ...DEFAULT_BASE, ...(playerState?.baseStats ?? {}) }
  return { playerState: { ...deriveEquipment(baseStats, weapon, playerState), baseStats }, fortunePending: false }
}
```

- [ ] **Step 5: Run runtime/rest tests and confirm GREEN**

Run:
```bash
node --test web/src/lib/games/dungeon/infinite-runtime.test.js web/src/lib/games/dungeon/rest.test.js
```
Expected: PASS.

### Task 4: Awakening-Aware Normalized VFX

**Files:**
- Modify: `web/src/lib/games/dungeon/weapon-vfx-profile.js`
- Modify: `web/src/lib/games/dungeon/weapon-vfx-profile.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-vfx-runtime.test.js`

**Interfaces:**
- Consumes: Task 1 `legendaryVfxTarget()`.
- Produces: awakening-dependent target pixel sizes and bounded density while retaining runtime texture normalization.

- [ ] **Step 1: Add failing VFX profile tests**

Add assertions that legendary profile sizes at levels 1/5/10/15/20 are exactly 16/18/20/22/24 and burst values are 12/14/16/18/20. Preserve `quantity <= 2`.

- [ ] **Step 2: Run VFX tests and confirm RED**

Run:
```bash
node --test web/src/lib/games/dungeon/weapon-vfx-profile.test.js web/src/lib/games/dungeon/weapon-vfx-runtime.test.js
```
Expected: FAIL because legendary profile is currently fixed at 16 px and burst 12.

- [ ] **Step 3: Feed growth metadata into the existing normalized profile**

For legendary rarity, replace fixed `size`, `burst`, and `quantity` with `legendaryVfxTarget(item)` results. Do not change the runtime's `targetPixelSize / sourceTextureSize` normalization logic.

- [ ] **Step 4: Run VFX tests and confirm GREEN**

Run:
```bash
node --test web/src/lib/games/dungeon/weapon-vfx-profile.test.js web/src/lib/games/dungeon/weapon-vfx-runtime.test.js
```
Expected: PASS, including the existing 512px-source normalization regression test.

### Task 5: Legendary Presentation and Level-Up Feedback

**Files:**
- Modify: `web/src/lib/games/dungeon/presentation.js`
- Modify: `web/src/lib/games/dungeon/presentation.test.js`
- Modify: `web/src/lib/games/dungeon/hud-runtime.js`
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/lib/games/dungeon/scene.test.js`

**Interfaces:**
- Consumes: materialized legendary item fields `name`, `legendaryLevel`, and `rarity: 'legendary'`, plus `legendarylevel` events from Task 3.
- Produces: legendary localization/color/name/level in HUD, ground presentation, and comparison output.

- [ ] **Step 1: Add failing presentation tests**

Assert that:

```js
const model = weaponHudModel({
  equippedWeapon: { type: 'weapon.stormcrown', name: 'Stormcrown', rarity: 'legendary', legendaryLevel: 10, damage: 120, affixes: [] },
  weaponRarity: 'legendary', weaponDamage: 120,
}, 'en')
assert.equal(model.name, 'Stormcrown')
assert.equal(model.legendaryLevel, 10)
```

Also extend `rarityPresentation('legendary')` to return a dedicated gold/orange presentation instead of Common fallback.

- [ ] **Step 2: Run presentation tests and confirm RED**

Run:
```bash
node --test web/src/lib/games/dungeon/presentation.test.js web/src/lib/games/dungeon/scene.test.js
```
Expected: FAIL because legendary is not first-class in these presentation paths.

- [ ] **Step 3: Implement first-class legendary presentation**

Add `rarityLegendary` translations (`传奇` / `Legendary`) and HUD label mapping in `+page.svelte`. Render named legendary weapons and append `Lv${legendaryLevel}` when present. Add legendary CSS/HUD color styling.

Extend `scene.js` `rarityPresentation()` with a dedicated legendary style, for example:

```js
legendary: { color: 0xffb84d, beamAlpha: 0.82, particles: 10 }
```

This ground-loot sparkle count is separate from equipped true-particle VFX and stays bounded.

Handle `legendarylevel` in page `onEvent()` with a short status message; do not pause gameplay.

- [ ] **Step 4: Run presentation tests and confirm GREEN**

Run:
```bash
node --test web/src/lib/games/dungeon/presentation.test.js web/src/lib/games/dungeon/scene.test.js
```
Expected: PASS.

### Task 6: Regression Verification and Single Implementation Commit

**Files:**
- Verify all files touched in Tasks 1-5.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified implementation on `main` with one clean implementation commit after the documentation commits.

- [ ] **Step 1: Run the focused legendary/infinite/combat suite**

```bash
node --test \
  web/src/lib/games/dungeon/legendary-growth.test.js \
  web/src/lib/games/dungeon/legendary-weapons.test.js \
  web/src/lib/games/dungeon/combat.test.js \
  web/src/lib/games/dungeon/infinite-runtime.test.js \
  web/src/lib/games/dungeon/rest.test.js \
  web/src/lib/games/dungeon/weapon-vfx-profile.test.js \
  web/src/lib/games/dungeon/weapon-vfx-runtime.test.js \
  web/src/lib/games/dungeon/presentation.test.js \
  web/src/lib/games/dungeon/scene.test.js
```

Expected: all tests PASS.

- [ ] **Step 2: Run syntax checks for changed production JS files**

```bash
node --check web/src/lib/games/dungeon/legendary-growth.js
node --check web/src/lib/games/dungeon/legendary-weapons.js
node --check web/src/lib/games/dungeon/combat.js
node --check web/src/lib/games/dungeon/infinite-runtime.js
node --check web/src/lib/games/dungeon/rest.js
node --check web/src/lib/games/dungeon/weapon-vfx-profile.js
node --check web/src/lib/games/dungeon/presentation.js
node --check web/src/lib/games/dungeon/hud-runtime.js
node --check web/src/lib/games/dungeon/scene.js
```

Expected: exit code 0 for every file.

- [ ] **Step 3: Verify repository diff is scoped**

Confirm the implementation diff contains only the legendary-growth feature, its tests, and required presentation integration. Do not modify legacy five-floor logic except the dedicated legendary rarity presentation entry.

- [ ] **Step 4: Create one implementation commit**

Use one commit for production + test changes:

```bash
git commit -m "feat: grow dungeon legendary weapons"
```

Do not force-update `main`. If `main` advanced, rebuild the implementation commit on the latest main tree before fast-forwarding.
