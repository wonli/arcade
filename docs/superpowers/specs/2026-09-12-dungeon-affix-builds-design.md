# Dungeon Affix Builds Design

## Goal

Turn dungeon equipment from a linear `+damage` pickup into the core run-to-run build system. A good drop should create a real decision: raw damage versus attack cadence, sustain, mobility, skill power, or a build-defining proc.

The first implementation stays deliberately compact: one equipped weapon, no inventory, crafting, rerolling, forging, sockets, or persistence. Picking up a weapon replaces the currently equipped weapon and recomputes the player's equipment-derived stats/effects.

## Design principles

- Affixes must materially affect play, not merely inflate item score.
- The system should be easy to read during a five-floor run.
- Rarity controls affix count: common 0, uncommon 1, rare 2, epic 3.
- Affixes come from one weighted pool with conflict groups rather than prefix/suffix bookkeeping.
- Higher floors improve roll strength and access to stronger build affixes.
- Floor 5 boss always drops Rare or Epic equipment containing at least one build affix.
- Base weapon damage remains a useful quick signal, but affix synergy can make a lower-damage weapon the better choice.

## Item model

A dungeon weapon becomes:

```js
{
  type: 'weapon.dungeon_blade',
  rarity: 'rare',
  damage: 7,
  affixes: [
    { id: 'attack_speed', tier: 2, value: 0.14 },
    { id: 'chain_lightning', tier: 1, value: 0.35 },
  ],
}
```

Affix values are generated from floor-aware ranges. Each affix has an id, category, weight, conflict group where necessary, tier/value roller, and presentation metadata.

## Initial affix pool

### Basic

1. `power` — increased weapon damage.
2. `attack_speed` — reduces auto-attack interval.
3. `critical` — increases critical chance.
4. `movement_speed` — increases movement speed.
5. `vitality` — increases max HP and heals the newly gained max HP on equip.
6. `life_steal` — restores a fraction of direct weapon damage dealt.

### Mechanic

1. `piercing` — weapon strike can continue into an additional enemy behind/near the target.
2. `chain` — weapon hit arcs reduced damage to a nearby enemy.
3. `corpse_burst` — kills damage nearby enemies.
4. `critical_heal` — critical hits restore HP.
5. `hurt_haste` — taking damage grants a short movement/attack-speed boost.
6. `low_health_damage` — increased damage below 40% HP.
7. `skill_radius` — increases SPACE skill radius.
8. `skill_haste` — reduces SPACE skill cooldown.

### Build-defining

1. `whirlwind` — weapon hits have a chance to trigger a circular secondary slash around the player.
2. `thunder` — critical hits chain lightning through nearby enemies.
3. `executioner` — substantially increases damage against enemies below 30% HP.
4. `berserker` — attack speed rises as player HP falls.

Build affixes use a shared `build` conflict group, so one item cannot roll multiple build identities in v1. This keeps a three-affix Epic readable and prevents proc stacking from overwhelming the five-floor balance.

## Rarity and floor rules

Affix slots:

- Common: 0
- Uncommon: 1
- Rare: 2
- Epic: 3

Normal drops use weighted affix selection. Floors 1-2 primarily roll basic affixes; mechanic affixes enter meaningfully from floor 2; build affixes become possible from floor 3 and increasingly likely on floors 4-5.

Boss rewards are always Rare or Epic and force one build affix before filling remaining slots from the normal pool. Existing guaranteed boss rarity behavior is preserved.

Duplicate affix ids and conflicting affixes are rejected during a single item roll.

## Equip semantics

Equipment bonuses are not permanently accumulated. The player has stable base stats and a single equipped weapon. On pickup, derived equipment stats are rebuilt from base stats plus the new weapon's base damage and affixes. This fixes the current behavior where every weapon pickup permanently adds damage and makes replacement meaningful.

The runtime exposes normalized effect fields for combat, for example attack interval multiplier, life steal, chain chance/damage, skill radius multiplier, and build proc configuration. Scene code consumes these fields; item generation does not depend on Phaser.

## Combat integration

- Auto attack interval uses attack-speed and berserker modifiers.
- Damage calculation includes power, low-health damage, and executioner target state.
- Critical hits can heal and/or trigger Thunder.
- Direct weapon damage can life-steal.
- Chain and piercing acquire secondary living targets and apply reduced damage without recursively retriggering the same proc.
- Corpse Burst triggers from enemy death and cannot recursively trigger itself.
- Hurt Haste is a timed runtime buff applied when the player takes damage.
- SPACE uses skill radius and skill-haste modifiers.
- Whirlwind is a chance-based secondary AoE and cannot recursively proc itself.

Proc recursion is explicitly prevented by passing a damage/proc context into secondary damage calls.

## Presentation

Ground labels retain rarity color and base damage but add a compact affix hint. The HUD shows the equipped weapon rarity/base damage plus its affix list. Build affixes receive stronger naming/presentation so the player can recognize a run identity immediately.

Affix labels are routed through the existing dungeon label mechanism so Chinese/English presentation can be supplied by the route instead of hardcoding user-facing descriptions throughout combat logic.

## Testing

Pure unit tests cover rarity slot counts, uniqueness/conflict rules, floor gating, deterministic affix rolls, boss guaranteed build affix, replacement semantics, derived stats, damage modifiers, and proc-safe helper behavior. Scene tests cover presentation-facing asset/logic contracts where useful. CI must pass both frontend tests and the full project build.

## Out of scope

No inventory, item comparison modal, crafting, rerolling, forging, sockets, armor slots, persistence, set items, affix extraction, or economy in this pass. Those can be layered onto this item model later without changing the combat-facing affix contract.
