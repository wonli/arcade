# Dungeon Affix Builds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn dungeon weapon drops into replaceable, floor-aware affix items that create distinct combat builds during a five-floor run.

**Architecture:** Keep item generation and stat derivation pure and Phaser-independent in a new `affixes.js` module. `combat.js` owns equipment generation and damage-facing helpers, while `scene.js` consumes normalized derived effects for runtime procs and `+page.svelte` renders localized affix names from emitted stats/events. The player keeps stable base stats plus one equipped weapon; every pickup rebuilds derived stats instead of accumulating bonuses.

**Tech Stack:** Svelte 5, JavaScript ES modules, Node `node:test`, Phaser runtime, GitHub Actions CI.

**Spec:** `docs/superpowers/specs/2026-09-12-dungeon-affix-builds-design.md`

## Global Constraints

- One equipped weapon only; no inventory, crafting, rerolling, forging, sockets, persistence, armor slots, set items, extraction, or economy.
- Affix slots are exactly: common 0, uncommon 1, rare 2, epic 3.
- Build affixes share one conflict group so a weapon can have at most one build identity.
- Build affixes are unavailable before floor 3.
- Floor 5 boss reward is always Rare or Epic and contains at least one build affix.
- Secondary proc damage must not recursively retrigger the same proc chain.
- Existing dungeon rarity colors, drops, portal progression, ranged enemies, and committed music remain intact.

---

### Task 1: Pure Affix Catalog and Roller

**Files:**
- Create: `web/src/lib/games/dungeon/affixes.js`
- Create: `web/src/lib/games/dungeon/affixes.test.js`

**Interfaces:**
- Produces: `AFFIXES`, `affixSlots(rarity)`, `rollAffixes(floor, rarity, random, { forceBuild })`, `deriveEquipment(base, item)`, `affixSummary(item)`.
- `deriveEquipment` returns player fields plus normalized `effects` used by scene code.

- [ ] **Step 1: Write failing tests** for slot counts, all 18 ids, duplicate/conflict rejection, floor gating, forced build roll, deterministic tier/value ranges, replacement semantics, vitality healing, and normalized effect fields.
- [ ] **Step 2: Run** `cd web && npm test -- --test-name-pattern="affix"` and verify RED because `affixes.js` does not exist.
- [ ] **Step 3: Implement `affixes.js`** with 6 basic, 8 mechanic, and 4 build definitions. Use category floor gates (`basic:1`, `mechanic:2`, `build:3`), weighted selection, three value tiers based on floor bands (1-2, 3-4, 5), and a shared `build` conflict group.
- [ ] **Step 4: Implement `deriveEquipment`** from base stats `{damage:10, critChance:0.18, speed:190, maxHp:100}` plus weapon base damage and affixes. Include normalized effects: `attackSpeed`, `lifeSteal`, `piercing`, `chain`, `corpseBurst`, `criticalHeal`, `hurtHaste`, `lowHealthDamage`, `skillRadius`, `skillHaste`, `whirlwind`, `thunder`, `executioner`, `berserker`.
- [ ] **Step 5: Run affix tests** and verify GREEN.
- [ ] **Step 6: Commit** `feat: add dungeon affix model`.

### Task 2: Equipment Generation and Replacement Semantics

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`

**Interfaces:**
- Consumes: `rollAffixes`, `deriveEquipment`.
- Produces: `rollEquipment(floor, random)`, `bossReward(random, floor)`, `applyPickup(player, item, baseStats)` with replace-not-stack behavior, and `modifiedDamage(player, enemy, baseDamage)`.

- [ ] **Step 1: Add failing combat tests** asserting rarity slot counts on generated gear, floor-3 build access, boss guaranteed build affix, and that replacing a +12 weapon with a +4 weapon reduces damage instead of accumulating both.
- [ ] **Step 2: Run** `cd web && npm test -- --test-name-pattern="equipment|boss reward|pickup"` and verify RED.
- [ ] **Step 3: Update equipment generation** so current rarity/damage tables remain the base roll and `affixes` are attached using the new roller; boss reward forces one build affix.
- [ ] **Step 4: Replace `applyPickup` weapon logic** with a rebuild from stable `baseStats`; preserve current HP ratio except vitality grants the newly added max HP immediately.
- [ ] **Step 5: Add target-aware damage helper** for low-health and executioner modifiers without changing crit randomness.
- [ ] **Step 6: Run combat tests** and verify GREEN.
- [ ] **Step 7: Commit** `feat: generate dungeon affix equipment`.

### Task 3: Runtime Combat Effects and Proc Safety

**Files:**
- Modify: `web/src/lib/games/dungeon/combat.js`
- Modify: `web/src/lib/games/dungeon/combat.test.js`
- Modify: `web/src/lib/games/dungeon/scene.js`

**Interfaces:**
- Scene consumes `playerState.effects` and uses damage context `{ proc: boolean, source: string }` to prevent recursive proc chains.

- [ ] **Step 1: Add failing pure tests** for attack interval scaling, berserker low-HP scaling, skill cooldown/radius scaling, life-steal amount, critical-heal amount, and secondary-target selection that excludes the primary/dead targets.
- [ ] **Step 2: Run focused tests** and verify RED.
- [ ] **Step 3: Implement pure helpers** in `combat.js`: `attackInterval`, `skillProfile`, `healFromHit`, `secondaryTarget`.
- [ ] **Step 4: Wire scene direct attacks** to target-aware damage, attack-speed interval, life steal, critical heal, chain, piercing, Thunder, and Whirlwind. Secondary damage calls pass `proc:false`/non-recursive context.
- [ ] **Step 5: Wire kill effects** so Corpse Burst damages nearby living enemies once without recursively triggering another corpse burst.
- [ ] **Step 6: Wire defensive/build effects**: Hurt Haste sets a short `hasteUntil`; player movement/attack interval reads it. Berserker scales attack speed with missing HP.
- [ ] **Step 7: Wire SPACE skill** to derived radius and cooldown values.
- [ ] **Step 8: Run full frontend tests** `cd web && npm test` and verify GREEN.
- [ ] **Step 9: Commit** `feat: activate dungeon affix combat effects`.

### Task 4: Drop and HUD Presentation

**Files:**
- Modify: `web/src/lib/games/dungeon/scene.js`
- Modify: `web/src/routes/dungeon/+page.svelte`
- Modify: `web/src/lib/games/dungeon/scene.test.js`

**Interfaces:**
- Scene emits weapon item including `damage`, `rarity`, `affixes` through existing `drop`, `pickup`, and stats callbacks.
- Route provides `labels.affix(id, value)` and renders equipped weapon affixes.

- [ ] **Step 1: Add failing presentation tests** for `affixSummary()`/scene label contract and stats retaining current equipped item affixes.
- [ ] **Step 2: Run focused frontend tests** and verify RED.
- [ ] **Step 3: Update ground labels** to show rarity/base damage plus one compact affix hint; build affixes use stronger typography/prefix treatment while keeping rarity color.
- [ ] **Step 4: Extend emitted stats** with `weaponDamage` and `weaponAffixes`.
- [ ] **Step 5: Add bilingual route labels** for all 18 affixes and render the current weapon affix list beneath the weapon/rank line without adding an inventory panel.
- [ ] **Step 6: Run `cd web && npm test`** and verify GREEN.
- [ ] **Step 7: Commit** `feat: show dungeon weapon affixes`.

### Task 5: Full Verification and Balance Sanity

**Files:**
- Modify only if verification exposes a defect.

- [ ] **Step 1: Run** `make test` and require exit 0.
- [ ] **Step 2: Run** `make build` and require exit 0.
- [ ] **Step 3: Inspect deterministic test coverage** to confirm common/uncommon/rare/epic slots, floor gates, boss build guarantee, replacement semantics, and proc recursion are represented.
- [ ] **Step 4: Verify latest GitHub Actions run** has both `Test project` and `Build project` successful on the exact final SHA.
- [ ] **Step 5: If verification fixes were needed, commit** `fix: stabilize dungeon affix builds`.
