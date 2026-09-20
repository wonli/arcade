# Dungeon Room Template Editor Design

## Goal

Provide a small visual editor at `/dungeon/room-editor` where an authored Dungeon3 room starts as an empty grid and the user places the exact Dungeon3 assets by hand. The editor exports a versioned room-template JSON file that can later be consumed by the randomized dungeon generator without asking the generator to invent wall, water, door, bridge, or stair geometry.

## Context

The existing `/dungeon/editor` route is a weapon/VFX combat sandbox and must remain unchanged. Dungeon3 visual correctness depends on the authored arrangements in `Dungeon3.tmx`, `walls_floor.png`, `doors`, `Arches_columns`, water tiles, and stairs. A procedural generator should select and connect authored rooms, not reconstruct their interior wall geometry from room rectangles.

## Scope

The first implementation includes:

- a separate Svelte route at `/dungeon/room-editor`;
- an empty, fixed-size native 16px room grid;
- a palette of real Dungeon3 tile/motif references extracted from `dungeon3Rules`;
- pointer-based placement and removal of floor, water, walls, corners, doors, flat/arch bridge features, stairs, and semantic connection ports;
- JSON export and JSON import in the browser;
- validation for asset references, grid bounds, port placement, water/bridge compatibility, and basic walkability;
- a stable schema that the future generator can select, transform, and connect.

The first implementation does not change `map-generator.js` to consume templates. It must make the template contract complete enough that generator integration can be added without changing the editor's saved files.

## TMX relationship

`Dungeon3.tmx` and generated `dungeon3-data.js` remain the authoritative source for visual resources. Room JSON stores semantic asset keys plus exact source references:

```json
{
  "asset": "wall.vertical.west",
  "source": {
    "tileset": "walls_floor",
    "cells": [
      { "tileId": 246, "flipX": false, "flipY": false, "flipDiagonal": false }
    ]
  }
}
```

The semantic key lets the generator reason about compatibility. The source reference preserves the exact tile selected in the editor and makes later TMX changes diagnosable. Raw TMX GIDs are not used as the public room-template identity.

## Room-template schema

Every exported file has this shape:

```json
{
  "schema": "dungeon3-room-template",
  "version": 1,
  "id": "room-untitled",
  "grid": { "tileSize": 16, "width": 12, "height": 10 },
  "cells": [
    { "x": 0, "y": 0, "kind": "floor", "level": 1 }
  ],
  "walls": [
    {
      "id": "north-wall",
      "side": "north",
      "segment": { "x": 0, "y": 0, "width": 12, "height": 1 },
      "asset": "wall.horizontal",
      "source": { "tileset": "walls_floor", "cells": [] }
    }
  ],
  "ports": [
    {
      "id": "east-door",
      "side": "east",
      "offset": 4,
      "span": 2,
      "kind": "door",
      "level": 1,
      "water": false,
      "allowed": ["door", "open"]
    }
  ],
  "features": [
    {
      "id": "bridge-1",
      "kind": "arch-bridge",
      "cells": [{ "x": 5, "y": 4 }],
      "asset": "bridge.arch",
      "source": { "tileset": "Arches_columns", "cells": [] }
    }
  ],
  "objects": [],
  "anchors": { "spawn": null, "exit": null, "lootSockets": [] }
}
```

`cells` describes logical terrain. `walls`, `features`, and `objects` describe authored visual/semantic compositions. Collision and navigation are derived from these records; the editor does not ask the user to hand-edit collision rectangles.

## Generator contract

When integration is added, generation proceeds in this order:

1. Generate a room graph and assign each room a level.
2. Choose a template whose dimensions, theme, and port requirements fit the graph slot.
3. Transform the template by an allowed rotation; mirroring is opt-in per asset because west/east wall art is not interchangeable.
4. Match ports before rendering. A level delta selects stairs; same-level water ports select flat or arch bridges; same-level dry ports select doors or open connections.
5. Stamp the template's logical cells, authored compositions, and derived collision into the global geometry.
6. Validate reachability after all port structures are connected.

The generator never adds a wall merely because a room edge exists. A wall, door, water boundary, and bridge only exist when the selected template or matched port says they exist.

## Validation rules

- Every referenced semantic asset resolves to a current Dungeon3 source reference.
- Every cell and feature remains inside the template grid.
- A port lies on the declared room edge and has a positive span.
- A bridge feature occupies water-connected cells and has a bridge asset.
- A door port is same-level and has a wall segment at its opening.
- A stair port is the only valid cross-level connector.
- A closed door contributes blocking geometry; an open door preserves its authored footprint.
- The template has at least one walkable path between its required anchors and ports.
- Import rejects unknown schema/version fields that would make rendering ambiguous, while preserving a clear error message.

## Non-goals

- Replacing the existing weapon/VFX editor.
- Editing the original TMX file in place.
- Rebuilding the entire Tiled application.
- Making the first editor version modify procedural generation.
- Automatically inferring correct walls from empty room rectangles.

## Acceptance criteria

- Opening `/dungeon/room-editor` shows an empty native-grid room and a palette of real Dungeon3 assets.
- A user can place and remove a resource without painting outside the grid.
- Exported JSON round-trips through import with no semantic or visual-reference loss.
- Invalid door/bridge/stair placements are reported before export.
- Existing `/dungeon/editor` and `/dungeon` behavior remain unchanged by the new route.
- `npm test` and `npm run build` pass.
