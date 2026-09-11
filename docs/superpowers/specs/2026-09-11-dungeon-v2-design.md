# Dungeon v2 Design

## Goal

Fix production identity/audio defects and deepen the five-floor dungeon with real monster sprite variety, three room layouts, and a materially stronger floor-5 boss.

## Production fixes

### Random ID compatibility

The browser identity helper must not assume `crypto.randomUUID` exists.

Generation order:

1. `crypto.randomUUID()` when available.
2. RFC-4122-style UUID v4 built from `crypto.getRandomValues()`.
3. A last-resort timestamp + `Math.random()` identifier for older/insecure runtimes.

Existing local/session storage keys remain unchanged.

### Audible dungeon ambience

Keep Web Audio and user-gesture startup, but shift the sound bed into frequencies ordinary laptop/monitor speakers reproduce reliably.

- audible drone/body roughly 90-220 Hz
- sparse metallic/bell accents roughly 300-700 Hz
- louder master gain than the existing 48/72 Hz implementation
- resume AudioContext after user interaction
- expose current audio state for diagnostics
- stop and close cleanly on scene teardown

## Monster diversity

Use only the existing Debts in the Depths asset pack. The asset selector must expose multiple creature assets rather than one generic enemy.

Gameplay roles:

- skeleton: baseline melee
- fast: low HP, high speed, visually distinct asset
- brute: high HP, slower, visually distinct asset
- optional ranged/charger role only when a clearly suitable existing creature asset is available

No new external art dependency.

## Room diversity

Five floors rotate through three authored room layouts inside the existing 960x600 arena:

1. Pillars
2. Cross Corridor
3. Broken Hall

Layouts vary decorative/static blockers, torches, visual lanes, and enemy spawn points. This iteration does not add pathfinding or procedural generation; blockers must not create unreachable combat states.

## Floor-5 boss

The floor-5 elite becomes a real boss rather than a scaled brute.

- approximately 6-8x normal floor-5 baseline HP
- larger sprite and boss health bar
- higher contact damage
- guaranteed at least Rare equipment drop, with materially increased Epic chance
- phase 2 begins below 50% HP
- charge attack with telegraph
- radial shockwave attack with telegraph and damage window
- fewer surrounding trash mobs than a normal 20-enemy floor so the boss remains the focus

## Constraints

- Keep the existing five-floor run and portal flow.
- Keep current player controls, auto attack, active skill, health potions, rarity system, and procedural audio approach.
- No inventory, persistence, new backend state, pathfinding framework, or external asset pack.
- Preserve English and Simplified Chinese UI behavior.

## Success criteria

- Production environments without `crypto.randomUUID` still create stable player/session IDs.
- Dungeon ambience is clearly audible on ordinary laptop/monitor speakers after first interaction.
- At least three gameplay enemy roles use visibly different existing creature sprites when the pack contains suitable assets.
- Floors cycle through three visually different room layouts.
- Floor 5 boss survives substantially longer than normal enemies, visibly enters phase 2, performs charge and shockwave attacks, and provides a high-quality guaranteed reward.
