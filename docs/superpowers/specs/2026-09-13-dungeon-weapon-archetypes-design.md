# Dungeon Weapon Archetypes Design

## Goal

Give Dungeon melee weapons three immediately readable play styles—dagger, sword, and katana—while keeping the existing equipment, rarity, affix, pickup, and multiplayer-facing state model intact.

## Architecture

Add a focused `weapon-profile.js` module that owns weapon archetype classification and gameplay/presentation multipliers. Equipment items gain an `archetype` field but remain `weapon.*` items and continue through `deriveEquipment`. The scene/runtime asks the profile for attack interval, auto-attack range, damage multiplier, knockback, swing duration, VFX scale, and held-weapon art.

The profile is the single source of truth so the visual weapon, attack cadence, target acquisition range, and slash feel cannot drift apart.

## Archetypes

### Dagger

Fast and close. Uses existing `dagger_*` / `gold_dagger.png` art. Attack interval multiplier 0.76, range 132, damage multiplier 0.88, knockback multiplier 0.72, short 105 ms swing.

### Sword

Current baseline. Uses existing `sword_*` / `gold_sword.png` art. Attack interval multiplier 1.0, range 165, damage multiplier 1.0, knockback multiplier 1.0, 150 ms swing.

### Katana

Longer reach and heavier single hit. Uses existing `katana.png` art. Attack interval multiplier 1.18, range 196, damage multiplier 1.14, knockback multiplier 1.16, 185 ms swing.

These multipliers are deliberately modest. Affixes still provide the build layer; archetype only establishes weapon identity.

## Drops

`rollEquipment` selects an archetype independently of rarity. Existing rarity probabilities, damage ranges, affix slots, and affix rolls remain unchanged. Boss reward also receives an archetype. Existing legacy `weapon.rust_sword` and saves/items without `archetype` resolve to sword.

## Equipment State

`deriveEquipment` preserves `equippedWeapon.archetype`. Base weapon damage remains item damage plus existing affix calculations; archetype damage multiplier is applied at attack resolution rather than mutating stored player damage. This avoids double-applying modifiers when equipment is re-derived.

## Visuals

`weapon-visual-runtime.js` resolves art from both archetype and rarity. Dagger uses dagger variants, sword uses current sword variants, katana uses katana art with rarity conveyed through scale/tint/VFX rather than inventing missing katana textures.

Pose geometry and swing duration are profile-driven. Katana gets a longer tip/arc; dagger stays tighter to the player.

## Combat Integration

`autoAttack` uses profile range. `attackInterval` accepts the archetype interval multiplier. `slash` applies profile damage/knockback and visual scale. Existing crit, lifesteal, affix proc, corpse burst, skill, and enemy calculations remain unchanged.

## Constraints

- Do not replace the inventory/equipment system.
- Do not change rarity/drop probability tables or affix probabilities.
- Do not change enemy/Boss stats.
- Do not add assets or persistent effects.
- Items without an archetype remain valid and behave as sword.
- Keep changes local; avoid restructuring the large Dungeon scene.

## Testing

Pure tests cover archetype fallback and numeric profiles. Combat tests cover cadence/range/damage identity and unchanged rarity behavior. Weapon visual tests verify dagger/sword/katana asset selection and archetype-specific swing geometry/duration.