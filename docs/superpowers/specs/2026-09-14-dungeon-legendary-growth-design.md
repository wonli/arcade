# Dungeon Legendary Weapon Growth Design

## Goal

Make the 12 `sword_11.png` through `sword_22.png` weapons feel like genuinely rare, run-defining artifacts in the endless Dungeon.

A legendary should be rare enough that finding one is exciting, immediately much stronger than same-floor Epic gear, and capable of carrying a player through roughly the next 20 floors as it grows. The feature must preserve the current infinite-floor architecture, existing affix/combat systems, and normalized weapon-particle sizing.

## Current Runtime Context

The live Dungeon is endless because `+page.svelte` installs `installInfiniteDungeon()`, which replaces the base scene's floor transition methods. The legacy five-floor guards in `scene.js` are not the live progression path after installation.

The endless runtime already owns:

- chapter/floor advancement via `advanceProgress()`
- combat/elite/boss/rest/treasure room roles
- floor-clear hooks
- player scaling
- fortune-based loot promotion

`playerState.equippedWeapon` already preserves the full equipped item. The pickup runtime also copies the full equipped item when swapping weapons, so legendary progression metadata can stay attached to the weapon object.

## Drop Rules

### Boss-exclusive legendary pool

The 12 named legendary swords remain Boss-exclusive:

- normal enemy legendary chance: **0%**
- treasure chest legendary chance: **0%**
- fortune promotion to legendary: **disabled**; fortune continues to cap at Epic
- Boss legendary chance: **5% per Boss kill**

When the 5% roll misses, Boss reward generation falls back to the previous Rare/Epic Boss reward logic. Bosses therefore continue to guarantee useful equipment without guaranteeing a legendary.

There is no pity system in this pass.

## Legendary Item State

A legendary item carries its own progression state:

```js
{
  rarity: 'legendary',
  legendaryLevel: 1,
  legendaryBaseDamage,
  legendaryBaseAffixes,
  ...normalWeaponFields
}
```

`legendaryLevel` is capped at **20**.

Awakening rank is derived from level rather than stored separately:

- Lv1-4: Awakening 0
- Lv5-9: Awakening I
- Lv10-14: Awakening II
- Lv15-19: Awakening III
- Lv20: Awakening IV / complete form

The base damage and base affixes are immutable snapshots. Every growth recalculation derives current `damage` and `affixes` from those snapshots. This prevents accidental compounding when the same weapon is recalculated repeatedly.

## Initial Power Target

A newly dropped Lv1 legendary should be approximately **2.5x-3.0x the practical combat power of a same-floor Epic weapon**.

The current catalog base damages remain weapon identity inputs, but legendary materialization applies a strong initial legendary multiplier. The target implementation is:

```text
Lv1 legendary damage ~= catalog base damage * 2.6 + floor depth bonus
```

The exact floor depth term should be monotonic and should not allow deep-floor Epic gear to immediately overtake a newly dropped legendary.

The existing four Tier-4 signature affixes remain intentionally above normal T3 values. They are part of the legendary's initial power budget, not optional rolls.

## Growth Trigger

While a legendary is equipped, it gains **1 level whenever a combat-capable room is cleared**:

- combat: +1
- elite: +1
- boss: +1
- antechamber with enemies: +1
- rest: +0
- treasure: +0

Growth happens on room clear, before the player enters the next room.

Only the currently equipped legendary grows. A legendary on the ground does not grow.

If a legendary is swapped out, its `legendaryLevel`, base snapshot, and current materialized stats remain on that item. Re-equipping it continues from the same level.

## Growth Curve

Legendary growth is strong and deliberately non-linear around awakening milestones.

### Damage

Current damage is recalculated from the immutable base snapshot:

```text
damageMultiplier = 1
  + 0.10 * (level - 1)
  + 0.20 * awakeningCount
```

where `awakeningCount` is 0-4 for Lv1 / Lv5 / Lv10 / Lv15 / Lv20.

This produces approximately:

- Lv1: 1.00x base legendary damage
- Lv5: 1.60x
- Lv10: 2.30x
- Lv15: 3.00x
- Lv20: 3.70x

Combined with the already-supercharged Lv1 baseline, Lv20 is intentionally extreme.

### Affixes

Every base affix grows from its immutable base value:

```text
affixMultiplier = 1
  + 0.025 * (level - 1)
  + 0.10 * awakeningCount
```

The weapon's two signature affixes receive an additional awakening identity multiplier:

```text
signatureMultiplier = 1 + 0.08 * awakeningCount
```

This preserves weapon identity instead of making all twelve converge toward the same generic stat block.

Existing combat caps remain authoritative where they already exist, such as crit chance, minimum attack interval, and skill-haste limits.

## Weapon Identity

Each legendary definition declares two signature affixes used by the growth engine:

- **King's Ruin** — `power`, `chain`
- **Sunfall** — `corpse_burst`, `berserker`
- **White Silence** — `executioner`, `critical`
- **Stormcrown** — `thunder`, `chain`
- **Void Testament** — `skill_haste`, `piercing`
- **Blood Oath** — `life_steal`, `berserker`
- **Dawn Reaver** — `attack_speed`, `piercing`
- **Cinder Vow** — `corpse_burst`, `power`
- **Winter's End** — `executioner`, `critical`
- **Thunderwake** — `thunder`, `chain`
- **Starless Edge** — `skill_haste`, `piercing`
- **Crimson Verdict** — `life_steal`, `low_health_damage`

This pass does not add twelve new combat proc types. It makes the existing combat mechanics dramatically stronger and lets each weapon's existing build identity dominate. New bespoke proc mechanics can be a later feature if the twelve weapons still feel too similar after playtesting.

## Rest Temper Interaction

Normal weapons keep the current `temper` behavior.

If the equipped weapon is legendary, choosing `temper` grants **+1 legendary level** instead of mutating one random affix. It cannot exceed Lv20.

This keeps rest rooms meaningful without creating a second mutation path that fights the immutable legendary base snapshot.

## VFX Growth

Legendary particle size must remain normalized by final on-screen pixel size. No code may directly expose source texture dimensions.

Target particle sizes by awakening:

- Lv1: 16 px
- Lv5: 18 px
- Lv10: 20 px
- Lv15: 22 px
- Lv20: 24 px

These are target render sizes, not raw Phaser scale factors. A 512x512 particle texture must still be scaled down to the target pixel size.

Particle density and burst can increase modestly with awakening, but the weapon/player silhouette must remain readable. Recommended upper bounds at Lv20:

- persistent particle target size: 24 px
- attack burst count: 20
- persistent quantity: 2

The existing semantic VFX theme and per-weapon variant remain unchanged.

## UI / Presentation

Legendary must be a first-class rarity in presentation code rather than falling back to Common.

Required presentation changes:

- add `legendary` localization in Chinese and English
- add legendary rarity color/presentation for ground loot and HUD
- show the named legendary weapon rather than generic `Dungeon Blade`
- show `LvN` beside equipped legendary name
- show awakening milestone feedback at Lv5/Lv10/Lv15/Lv20
- comparison card must compare the current materialized stats, not the immutable base snapshot

A legendary level-up should produce a short visual/text feedback event, but it must not pause gameplay.

## Architecture

Add a focused `legendary-growth.js` module responsible for:

- identifying legendary weapons
- deriving awakening count from level
- materializing current damage/affixes from immutable base snapshots
- incrementing legendary level
- exposing VFX target-size/intensity metadata

`legendary-weapons.js` remains responsible for the 12 definitions and Boss legendary selection.

`combat.js` remains responsible for Boss reward routing: 5% legendary, otherwise normal Boss reward.

`infinite-runtime.js` owns the room-clear integration point and calls the growth module only after a combat-capable room is actually cleared.

`rest.js` delegates legendary tempering to the growth module.

`weapon-vfx-profile.js` reads legendary awakening VFX metadata but continues to use the existing runtime texture normalization.

Presentation/HUD files only render the state; they do not calculate legendary power.

## Data Flow

1. Boss dies.
2. Boss reward rolls 5% legendary chance.
3. On success, `rollBossLegendary()` creates a Lv1 item with immutable base snapshots and materialized Lv1 stats.
4. Pickup flow equips the full item object through existing `deriveEquipment()`.
5. Infinite runtime clears a combat-capable room.
6. If equipped item is legendary and below Lv20, growth module returns a new materialized item at level +1.
7. `deriveEquipment()` recalculates player state from that weapon.
8. HUD/VFX update naturally from the new equipped item.
9. If swapped out, the complete legendary object is dropped and keeps its progression state.

## Error / Compatibility Rules

- A legacy legendary item without base snapshot fields is normalized lazily from its current damage/affixes the first time growth code sees it.
- Invalid/missing `legendaryLevel` becomes Lv1.
- Growth never exceeds Lv20.
- Missing signature-affix metadata falls back to normal all-affix scaling.
- Non-legendary items pass through growth helpers unchanged.
- Fortune never upgrades Epic into Legendary.

## Testing

Focused unit tests must cover:

1. normal enemy and chest paths cannot create Boss legendary swords
2. Boss roll below 5% returns a legendary; roll above threshold returns Rare/Epic fallback
3. all 12 legendary definitions materialize at Lv1 with immutable base snapshots
4. newly dropped legendary damage materially exceeds same-floor Epic baseline
5. room clear grows an equipped legendary exactly one level
6. rest/treasure rooms do not grow legendary weapons
7. Lv20 is a hard cap
8. swapping a legendary out and back preserves its level/state
9. repeated materialization at the same level is idempotent
10. Lv5/Lv10/Lv15/Lv20 awakening multipliers are correct
11. legendary temper grants +1 level and normal temper remains unchanged
12. normalized VFX target sizes are exactly 16/18/20/22/24 px by awakening
13. 512px particle sources remain normalized to the same target pixel size
14. legendary UI name/rarity/level presentation is supported
15. existing Rare/Epic Boss reward and non-legendary combat tests remain green

## Success Criteria

The feature is successful when:

- legendary acquisition is uncommon because only Bosses can drop one at 5%
- a Lv1 legendary immediately feels dramatically stronger than same-floor Epic gear
- keeping the weapon equipped visibly grows it over subsequent combat rooms
- Lv20 output is roughly 3.7x the Lv1 legendary damage before other player progression multipliers
- a legendary acquired around a Boss can realistically dominate roughly the next 20 floors while the endless-dungeon enemy curve continues increasing
- the 12 weapons retain different identities through their signature affixes and VFX themes
- legendary visual effects can become more dramatic without violating particle-size normalization
- no five-floor legacy path is used to implement or test legendary progression
