# Dungeon Weapon Identity 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `executing-plans` to execute this plan task by task. Every behavior change follows TDD: add a failing regression test, verify RED, implement the minimum change, then verify GREEN.

**Goal:** Make bow and staff viable immediately through deterministic signatures, fix wall/target fairness across weapon types, promote ranged weapons to ordinary drops, and unlock the existing VFX inventory without adding active-skill controls.

**Architecture:** Keep weapon-profile stats as the baseline and add small focused runtime modules around them. A shared targeting helper owns line-of-sight/attackability. Projectile runtime owns bow world-projectile behavior and staff homing/reacquisition. A dedicated signature runtime owns deterministic cadence and Staff signature effects. Catalog/drop code owns archetype/signature generation. Existing affix runtime is simplified so Volley/Arcane Nova augment deterministic signatures instead of randomly unlocking them.

**Tech Stack:** JavaScript ES modules, Node `node:test`, Phaser runtime mocks, SvelteKit/Vite production build, GitHub Actions for remote verification.

**Spec:** `docs/superpowers/specs/2026-09-14-weapon-identity-2-design.md`

---

## Task 1: Shared attackability and wall fairness

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-targeting.js`
- Create: `web/src/lib/games/dungeon/weapon-targeting.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-combat-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-combat-runtime.test.js`

**RED tests:**
1. An enemy behind a solid rectangle is not attackable.
2. Auto-targeting skips a closer blocked enemy and selects the nearest visible enemy.
3. Melee slash does not resolve damage through a solid wall.
4. Ranged targeting requires line of sight before launch.

**Implementation:**
- Add a pure `hasLineOfSight(start, target, geometry, padding)` helper backed by `clipSegmentToSolids`.
- Add `isWeaponTargetAttackable(player, target, profile, geometry)` and `nearestAttackableTarget(...)`.
- Update `weapon-combat-runtime.js` auto-attack to use the shared helper instead of raw `nearestTarget` + distance only.
- Guard the wrapped slash too, so manual/runtime calls cannot bypass the wall rule.
- Keep current weapon ranges unchanged.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/weapon-targeting.test.js src/lib/games/dungeon/weapon-combat-runtime.test.js`

---

## Task 2: Bow world projectile and deterministic Power Shot

**Files:**
- Modify: `web/src/lib/games/dungeon/weapon-projectile-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-projectile-runtime.test.js`
- Modify if needed: `web/src/lib/games/dungeon/weapon-vfx-runtime.js`
- Modify if needed: `web/src/lib/games/dungeon/weapon-vfx-runtime.test.js`

**RED tests:**
1. Every fourth valid primary bow launch is marked Power Shot; no RNG call controls it.
2. Power Shot primary damage is `160%` of the rolled weapon hit.
3. Power Shot continues after the first enemy and may hit exactly one second enemy for `70%` of base weapon damage.
4. The second Power Shot hit is non-direct, non-healing, and non-proccing.
5. A normal bow arrow whose original target dies keeps flying and can hit another enemy intersecting its path.
6. Bow projectiles still stop on room geometry.
7. Power Shot continues using the real arrow sprite.

**Implementation:**
- Track a bow primary-launch counter modulo 4 inside projectile runtime.
- Reset cadence whenever equipped weapon identity changes.
- Decouple bow collision from `projectile.target`: on every update, test the moving arrow against living enemies and resolve the first intersecting enemy not already hit.
- Keep the target only as initial aim direction metadata.
- For Power Shot, set primary scale `1.60`, retain the projectile after first hit, and allow one secondary hit at `0.70` with recursion/heal disabled.
- Normal bow arrows are removed after the first enemy hit.
- Keep geometry collision and lifetime limits.
- Add a stronger resource-only launch/impact treatment for Power Shot if a suitable existing VFX hook exists; never draw geometry.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/weapon-projectile-runtime.test.js src/lib/games/dungeon/attack-vfx-contract.test.js`

---

## Task 3: Deterministic Staff signatures

**Files:**
- Create: `web/src/lib/games/dungeon/weapon-signature-runtime.js`
- Create: `web/src/lib/games/dungeon/weapon-signature-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-projectile-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-projectile-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-vfx-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-vfx-runtime.test.js`

**RED tests:**
1. Staff cadence advances only on successful primary staff hits; the third hit fires exactly one signature.
2. A blocked/expired staff shot does not advance the cadence.
3. Equipping a different weapon/signature resets progress.
4. Missing signature defaults to `arcane_burst`.
5. Arcane Burst deals `+60%` to primary and `35%` to other enemies inside `88 * (1 + skillRadius)`; primary is excluded from splash.
6. Storm Palm deals `60/35/20%` to primary/chain1/chain2 and never exceeds two chain targets; every segment calls resource-backed lightning VFX.
7. Frost Blizzard lasts about 1.2s, ticks three times for `20%` each, respects `92 * (1 + skillRadius)`, and applies/removes a `22%` temporary slow.
8. Signature secondary damage is `{ direct:false, canProc:false }` and cannot advance signature cadence.
9. Arcane Nova affix augmentation damages only other enemies in `76 * (1 + skillRadius)` for `weaponDamage * (0.20 + arcaneNova)`.
10. Staff target death triggers visible-target reacquisition within ~180px instead of immediate projectile expiry.

**Implementation:**
- Put signature state/effect logic in `weapon-signature-runtime.js`, not `attack-runtime.js`.
- Expose a small API such as `onStaffHit(primary, baseDamage)`, `update(time, delta)`, and `resetIfWeaponChanged()`.
- Integrate projectile `hit()` so only primary staff weapon hits call `onStaffHit` after the direct hit/procs resolve.
- Reacquire the nearest living visible enemy from current projectile position when a staff target dies; never teleport projectile position.
- Arcane Burst uses resource-backed aura/sparkle/explosion hooks.
- Storm Palm uses `scene.__dungeonVfx.lightning` for each segment.
- Frost Blizzard stores active area state and handles damage/slow in the runtime update loop; preserve each enemy's original speed multiplier and restore it safely after expiry.
- Staff base impacts get a small resource-only magical spark even for common weapons.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/weapon-signature-runtime.test.js src/lib/games/dungeon/weapon-projectile-runtime.test.js src/lib/games/dungeon/weapon-vfx-runtime.test.js`

---

## Task 4: Migrate ranged build affixes to deterministic augmentation

**Files:**
- Modify: `web/src/lib/games/dungeon/attack-runtime.js`
- Modify: `web/src/lib/games/dungeon/attack-runtime.test.js` or add `web/src/lib/games/dungeon/weapon-affix-runtime.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-skill.js` only if the old group-skill lookup becomes unnecessary

**RED tests:**
1. Bow `volley` is not rolled as a random proc from `applyWeaponProcs`.
2. Every Power Shot with `effects.volley > 0` emits up to two secondary real arrows.
3. Each Volley arrow damage is `base weapon damage * (0.35 + volley)` and cannot heal/proc/advance cadence.
4. Staff `arcane_nova` is not rolled as a random proc from `applyWeaponProcs`.
5. Every Staff signature with `effects.arcaneNova > 0` emits the deterministic nova augmentation.
6. Existing melee Whirlwind remains random as before.
7. Restored Thunder behavior remains `critical && chance`; do not change it.

**Implementation:**
- Delete only the Volley and Arcane Nova random branches from `scene.applyWeaponProcs`.
- Trigger Volley from the Power Shot path in projectile runtime.
- Trigger Arcane Nova from Staff signature runtime.
- Preserve Piercing, Chain, Thunder, Whirlwind, Corpse Burst, healing, and other unrelated proc behavior.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/attack-runtime.test.js src/lib/games/dungeon/weapon-projectile-runtime.test.js src/lib/games/dungeon/weapon-signature-runtime.test.js`

---

## Task 5: Make bow/staff real ordinary drops

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-catalog.js`
- Modify: `web/src/lib/games/dungeon/weapon-catalog.test.js`
- Modify: `web/src/lib/games/dungeon/weapon-catalog-runtime.js`
- Modify: `web/src/lib/games/dungeon/weapon-catalog-runtime.test.js`
- Modify if new early identities are needed: `web/src/lib/games/dungeon/weapon-art.js`, `web/src/lib/games/dungeon/presentation.js`

**Important existing constraint:** generic drops are converted to named catalog weapons by `weapon-catalog-runtime.js`. The current catalog does not make bow/staff available until floor 5, so changing only `combat.js` would not satisfy the feature.

**RED tests:**
1. Generic archetype roll boundaries implement 60% melee / 20% bow / 20% staff while preserving current dagger/sword/katana proportions inside the melee 60%.
2. Normal boss generic rewards use the same archetype rule.
3. Fixed `weapon.rust_sword` remains fixed.
4. Generic named-weapon materialization can produce bow and staff from floor 1 rather than silently converting them back to melee.
5. Staff materialization adds a signature using deterministic 40/30/30 boundaries.
6. Existing staff item without `signature` remains compatible and resolves to Arcane Burst at runtime.
7. Ranged build affixes still specialize to Volley/Arcane Nova after catalog materialization.

**Implementation:**
- Centralize generic archetype selection rather than maintaining different hidden distributions.
- Ensure catalog selection respects the requested generic archetype. Add minimal early bow/staff standard identities using existing named weapon art where possible rather than procedural combat art; do not alter legendary balance in this core pass.
- Preserve rarity/damage/depth/affix data when materializing identity.
- Add/retain Staff `signature` on the item.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/combat.test.js src/lib/games/dungeon/weapon-catalog.test.js src/lib/games/dungeon/weapon-catalog-runtime.test.js src/lib/games/dungeon/affixes.test.js`

---

## Task 6: Unlock known VFX packs safely

**Files:**
- Modify: `web/src/lib/games/dungeon/vfx-assets.js`
- Modify: `web/src/lib/games/dungeon/vfx-assets.test.js`
- Modify: `scripts/prepare-dungeon-assets.mjs`

**RED tests:**
1. Classifier can use full path and explicit `source` metadata, not only basename.
2. Generic filenames from the Lightning pack can still classify as lightning via source context.
3. Foozle/free-pixel-magic path/source fixtures classify known semantic folders even when final filenames are generic.
4. Existing alpha/preview/retro-impact safety filters remain intact.

**Implementation:**
- Extend `classifyVfxAsset(..., { hasAlpha, source })`.
- Match semantic rules against full normalized path first; use source-specific defaults only when safely scoped.
- Pass `pack.source` from `walkVfx`.
- Do not blindly accept every transparent PNG. Unknown files remain excluded.
- Leave Retro Impact RAR packaging as a separate asset-only follow-up if the CI environment still cannot extract it; do not make the core combat change depend on that archive.

**GREEN command:**
`cd web && node --test src/lib/games/dungeon/vfx-assets.test.js`

---

## Task 7: Integration verification and cleanup

**Files:** all files changed above plus temporary CI workflow only while verifying.

**Verification:**
1. Run focused Weapon Identity tests.
2. Run the full web test suite: `cd web && npm test`.
3. Run asset preparation: `node scripts/prepare-dungeon-assets.mjs` and inspect classified counts/sources.
4. Run production build: `cd web && npm run build`.
5. Verify no procedural Phaser geometry was added to combat attack VFX.
6. Verify no active-skill UI/control or mana system was added.
7. Remove temporary GitHub Actions workflow.
8. Squash implementation work after base `6c163dde4b532ad74bc4a6f37c5a5be730cff200` into one clean feature commit, retaining the approved design history before it.
9. Compare base to final commit and confirm only intended plan/code/test files changed.

**Final commit message:**
`feat(dungeon): make ranged weapons viable by default`

## Deferred milestone

Adding dedicated bow/staff legendary identities is intentionally deferred until the core deterministic system is playable and balanced. Existing legendary behavior must not regress in this pass.
