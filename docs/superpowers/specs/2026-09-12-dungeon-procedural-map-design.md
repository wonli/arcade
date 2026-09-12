# Procedural Dungeon Map Design

## Goal
Replace the legacy fixed room templates with deterministic-per-run procedural dungeon layouts that use the full Dungeon3 tileset vocabulary: rivers, bridges, stairs, doors, columns/arches, floor plates, coffins, statues, traps, torches, chests, and authored water animation/coasts.

## Core rules
- A run owns a seed. A floor derives a stable floor seed from the run seed, so re-entering the same floor keeps the same map; a new run produces a new map.
- Ground actors cannot traverse water or void. Bridges and stairs are walkable. Flying enemies may cross water but still obey outer bounds and hard solids.
- Every generated map must pass connectivity validation before use. Player spawn, exit/door, chest area, bridge endpoints, and combat anchors must be reachable for a ground actor. Invalid candidates are regenerated with a bounded retry count and then fall back to a known-valid layout.
- Interior route control should prefer rivers, banks, bridges, elevation lips, props, and traps over long artificial wall bars. Interior walls are optional and sparse.
- Decorations are generated only after the walkable topology is accepted and must not block the reserved A* critical path.

## Generation model
Use a grid-first generator over the existing 960x600 playfield. Generate one or two broad river bands, select bridge crossings, reserve a connected critical route, then place stairs/doors/landmarks and secondary props. Convert the accepted grid to the existing geometry representation used by collision/rendering.

## Navigation
Keep the existing A* implementation but add navigation profiles:
- `ground`: floor/bridge/stairs are traversable; water is blocked.
- `flying`: water is traversable; hard solids/bounds remain blocked.
Use the same navigation model both for generator validation and runtime enemy pathing.

## Dungeon3 asset usage
- `Water_coasts_animation.png`: use authored water/coast animation and coast tiles for river bodies and banks.
- `Arches_columns.png`: use columns/arches as landmarks and door framing instead of generic obstacles only.
- `doors.png`: place authored entrance/exit doors at valid boundary/room transitions.
- `stairs.png`: use for elevation transitions and bridge approaches.
- `plates.png`: use as paths, bridge decking, and floor accents.
- `coffins.png`, `other_objects.png`, `Statue_fire.png`: use as weighted decoration pools outside reserved routes.
- `plate_trap.png`, `Spikes.png`: use as trap tiles; traps are walkable hazard tiles, not solid blockers.
- `torches.png` / `candles.png`: use multiple authored variants and animations for lighting accents.
- `chest_lever.png`: use the authored chest opening animation; opened chests remain on the terminal opened frame/state for the remainder of the room.

## Rendering layers
Render in terrain order: base floor -> floor detail/path plates -> lowered water -> coast/lip -> bridge/stairs -> props/traps -> actors -> foreground props/lights. This preserves visible height differences around water and grounds columns/statues on the floor.

## Safety and fallback
Generation retries are deterministic for a seed. If validation still fails after the retry budget, use a generated-safe fallback with at least one river, one bridge, a reachable exit, and no blocking decorations on the critical path.
