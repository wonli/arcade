# Dungeon Editor Design

## Goal

Add `/dungeon/editor` as a real Dungeon combat sandbox for tuning weapon presentation and VFX without duplicating the game runtime.

## Runtime Architecture

Dungeon runtime is split conceptually into reusable combat core and run progression:

- Core: spatial room rendering/collision, player movement/animation, weapon visuals/combat/VFX, enemies/AI, pickups and combat feedback.
- Run: infinite floor progression, rest/boss roles, floor clear, legendary growth, portal/backtracking progression.
- `/dungeon` installs Core + Run.
- `/dungeon/editor` installs Core + `DungeonEditorRuntime` only.

The editor starts a real ordinary combat room with real enemies. WASD, attacks, skills, collision, enemy AI, hit/death feedback and VFX remain live.

## Editor Sandbox

The sandbox runtime adds development-only controls without creating alternate game objects:

- select and immediately equip any weapon from `WEAPON_CATALOG`;
- randomize/reload a real spatial combat room;
- choose an enemy archetype and click the Phaser canvas to place a real enemy at that world position;
- spawn enemies around the player;
- clear enemies;
- toggle enemy AI;
- toggle player invincibility;
- toggle enemy invincibility.

Manual enemies use the same low-level enemy construction path as normal spawns. Normal spawn selection becomes a thin wrapper around that reusable function.

## Presentation Model

Version-controlled defaults live at:

`web/config/dungeon/weapon-presentation.json`

The file stores presentation multipliers and sockets, not derived gameplay values.

- `scale`: multiplier applied after existing archetype/rarity/art scale.
- `grip`: normalized local coordinate on the weapon image.
- `vfxAnchor`: normalized local coordinate on the weapon image.
- `vfxSizeScale`: multiplier applied after `weaponVfxProfile()` derives rarity/legendary-level particle size.
- `poses.idle|attack.<facing>`: player-relative mount x/y and angle.

VFX world positions are derived by transforming `vfxAnchor` through the weapon visual's origin, scale, rotation and horizontal flip. This removes the need for direction-specific `tipDx/tipDy` VFX offsets.

## Config Storage

`web/config/dungeon/*.json` is the source-controlled default configuration and is embedded into the Go binary.

Runtime editor saves are temporary overrides under:

`data/dungeon/*.json`

Read precedence:

1. `data/dungeon/<name>.json` when present.
2. embedded `web/config/dungeon/<name>.json` otherwise.

HTTP API:

- `GET /api/dungeon/config/weapon-presentation` returns `{ source, config }`.
- `PUT /api/dungeon/config/weapon-presentation` validates and atomically writes the complete override file.
- `DELETE /api/dungeon/config/weapon-presentation` removes the override and falls back to embedded defaults.

The editor never writes Git history or source files.

## Editor UI

The page is a two-column workbench:

- left: the real Phaser Dungeon sandbox;
- right: a magnified DOM inspector using the same player animation asset and weapon art.

Right-side controls cover weapon selection, facing, idle/attack pose, mount x/y, rotation, weapon scale, VFX anchor and VFX size scale. Drag operations update a working presentation state and immediately update the live Phaser weapon runtime. Numeric fields allow precise edits.

Top-level actions: Save, Restore Default, Import JSON, Export JSON, Random Room.

## Constraints

- Do not duplicate a Phaser preview scene.
- Do not duplicate player, weapon, enemy or VFX construction.
- Editor changes affect presentation only; gameplay damage/progression data remains authoritative elsewhere.
- Editor must not trigger infinite-floor clear, portal opening or legendary growth.
- Production binaries can read embedded defaults and use runtime overrides; source-tree discovery and environment-variable config roots are not required.
