# Dungeon Gameplay Pass Design

## Goal
Turn the current combat foundation into a repeatable roguelite loop: readable enemy intent, recognizable builds, room events, a second encounter family, and conservative transient-effect budgets.

## Boundaries
Keep the current equipment/inventory model, floor progression, arena layouts, multiplayer protocol, and five-floor run. Prefer focused profile/runtime modules; scene.js stays authoritative and gets only narrow hooks. No new external asset packs.

## Enemy intent
Fast compresses before dash, Brute gathers before slam, and Ranged signals projectile release. Presentation follows existing behavior timing and does not alter damage or cooldowns.

## Build identity
Reuse existing affixes. Classify Lightning (thunder/chain), Reaper (executioner/corpse burst), Blood Rush (life steal/critical heal plus dagger cadence), Tempest (whirlwind/skill modifiers), and Berserker (berserker/low-health damage). Weapon archetypes provide affinity, not restrictions. Drop presentation exposes likely build contribution.

## Room events
Layer combat, elite, treasure, rest, and antechamber profiles over existing arenas. Events describe encounter/reward/rest behavior; the arena renderer is unchanged. Floor 5 remains Boss.

## Encounter variety
Add variants using existing enemy art and a second Boss profile selected deterministically. New profiles change attack pattern rather than duplicating the current Boss.

## Performance
Cap cosmetic transient shapes/VFX and projectiles. When over budget, skip cosmetics before gameplay. Avoid new per-frame allocations where practical.

## Testing
Use pure profile tests and focused runtime contract tests. Preserve rarity/affix probabilities, player HP formulas, existing Boss timings, and multiplayer payload shape.