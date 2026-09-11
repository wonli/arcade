# Dungeon Five-Floor Loop Design

## Goal

Turn the current Endless Dungeon combat prototype into a short, replayable five-floor dungeon run with visible progression, differentiated enemies, floor-scaled loot rarity, and a portal transition between floors.

## Scope

### Floors

- A run contains floors 1 through 5.
- Each floor starts with a fresh enemy wave.
- When all enemies on the floor are defeated, combat stops spawning enemies and a green exit portal appears.
- Walking into the portal advances to the next floor.
- Floor 5 is an elite/boss test floor.
- Clearing floor 5 ends the run and shows a simple completion state.
- The same room layout is reused for all five floors in this iteration.

### Enemy archetypes

Use existing dungeon creature assets only; do not add a new art dependency.

Three gameplay archetypes are required:

1. `skeleton`
   - baseline HP, speed, size, and contact damage
2. `fast`
   - lower HP, higher speed, smaller visual scale
3. `brute`
   - higher HP, lower speed, larger visual scale, thicker health bar

Floor 5 spawns at least one elite/brute enemy with stronger stats than normal floor 5 enemies.

### Equipment rarity

Equipment drops use four rarities:

- `common` — white
- `uncommon` — green
- `rare` — blue
- `epic` — purple

Equipment remains intentionally simple in this iteration:

- all equipment is an immediate damage upgrade
- no inventory or equipment screen
- no affixes
- no slots

Damage bonus ranges:

- common: +2 to +3
- uncommon: +4 to +5
- rare: +6 to +8
- epic: +9 to +12

The equipment name and loot beam color reflect rarity.

### Floor-scaled rarity

Deeper floors slightly improve rare and epic chances.

Exact implementation must remain deterministic for a supplied random value and testable in pure JavaScript. The final probability table can be tuned during implementation, but all floors must preserve this ordering:

`common > uncommon > rare > epic`

and floors 4-5 must have a strictly higher combined `rare + epic` probability than floor 1.

### Potions

Health potions remain an independent drop channel from equipment. A kill may produce a potion, equipment, both, or neither.

Existing potion behavior remains unchanged:

- heal amount: 28 HP
- healing is capped by `maxHp`

### Presentation

- Entering a floor shows a large `FLOOR N` title briefly.
- Clearing a floor shows `FLOOR CLEAR`.
- A green animated portal appears only after the floor is clear.
- Elite/brute enemies have a visibly thicker health bar.
- Rare and epic equipment drops use stronger beams and particles than common/uncommon drops.
- Existing procedural dungeon ambience remains active across floor transitions.

### Internationalization

New player-facing strings must remain translation-key driven and support the existing `zh-CN` and `en` setup.

Required concepts include:

- floor title
- floor clear
- run complete
- rarity names
- pickup event text

## Architecture

Pure gameplay rules stay in `web/src/lib/games/dungeon/combat.js` so floor scaling, enemy archetype selection, rarity rolling, and pickup math remain testable without Phaser.

The Phaser scene in `web/src/lib/games/dungeon/scene.js` owns presentation and runtime orchestration:

- spawn the current floor wave
- track whether the floor is cleared
- render and detect the portal
- apply archetype presentation differences
- render rarity beams and labels
- transition between floors without recreating the whole web route

The existing Svelte route and Go embedded frontend behavior remain unchanged.

## Non-goals

Do not add in this iteration:

- procedural room generation
- infinite floor generation
- inventory UI
- equipment slots
- random affixes
- persistent save data
- SQLite or backend persistence
- multiplayer dungeon state
- new external asset packs

## Success Criteria

A player can start on floor 1, kill the wave, enter a portal, continue through floors 2-5, see enemy difficulty and loot quality noticeably increase, defeat an elite encounter on floor 5, and reach a clear run-complete state without leaving `/dungeon`.
