# Dungeon Weapon VFX Identity Implementation Plan

**Goal:** Make the 12 named Dungeon weapons keep stable, distinct particle identities while rarity controls only visual intensity and Rare+ weapons fall back instead of silently losing particles.

**Scope:** Weapon catalog identity metadata, weapon VFX profile/runtime selection, and focused tests only. Do not change combat math, drop rates, attack timing, room progression, or the global VFX loader.

## Tasks

1. Add failing coverage for per-weapon VFX variants, legacy named-weapon recovery, and static particle fallback.
2. Add stable `vfxVariant` metadata to all 12 weapon definitions and preserve it when drops are materialized.
3. Resolve theme/archetype/variant from the named weapon catalog, keep rarity as the intensity source, and let archetype tune particle motion.
4. Select static particle candidates by semantic kind/source preference, rotate deterministically by the weapon variant, and fall back to another loaded static texture when the preferred kind is unavailable.
5. Run focused Node tests and syntax checks for every changed JavaScript module before committing.
