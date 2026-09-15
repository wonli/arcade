# Dungeon Single-Player PlayerEntity Cleanup Design

## Goal

Finish the Dungeon single-player refactor so every player-dependent gameplay runtime works from an explicit `PlayerEntity`, while preserving the current `/dungeon/` behavior exactly. Multiplayer is out of scope.

## Current state

`scene.localPlayer` is already the single source of truth, but compatibility aliases still expose `scene.playerState`, `scene.player`, `scene.playerBar`, `scene.playerFacing`, `scene.playerMoving`, `scene.playerAttacking`, `scene.lastAttackAt`, `scene.skillReadyAt`, `scene.lastContactAt`, and `scene.dead`. Several runtimes still consume those aliases directly.

## Target architecture

`PlayerEntity` owns gameplay state and per-player presentation/runtime state: `state`, `actor`, `bar`, `facing`, `moving`, `attacking`, combat timers, and `dead`.

Single-player Scene remains the orchestration boundary. Scene methods may keep local-player convenience wrappers for compatibility with the rest of Dungeon, but all player-aware implementation logic must receive or resolve an explicit `PlayerEntity` before touching player data.

No runtime may depend on the legacy Scene aliases after cleanup. Once all consumers are migrated, `attachLocalPlayerEntity` stops defining alias properties and only assigns `scene.localPlayer`.

## Scope

Migrate, in order:

1. Scene core player lifecycle and presentation.
2. Spatial movement, traps, enemy targeting/projectiles, and chest interaction.
3. Enemy behavior targeting/contact damage.
4. Attack, damage feedback, weapon combat, and player-facing presentation.
5. Pickup/inventory/interact and gameplay-pass room effects.
6. Remove legacy Scene player aliases and add a static regression contract preventing their return.

## Explicit player API rule

Runtime functions should follow one of these forms:

```js
function updateSomething(scene, player, ...args) {}

export function installSomething(scene, { player = scene.localPlayer, ...options } = {}) {}
```

Installers may default to `scene.localPlayer` for single-player ergonomics, but internal logic must use the captured/explicit `player` object rather than `scene.playerState` or sibling aliases.

Scene convenience methods should delegate explicitly:

```js
scene.hitPlayer = (damage) => hitPlayer(scene, scene.localPlayer, damage)
scene.updatePlayer = (dt) => updatePlayer(scene, scene.localPlayer, dt)
```

This is intentionally not a multiplayer implementation; it merely makes the single-player code entity-correct.

## Behavior constraints

- No gameplay balance, timings, damage, drop rates, movement speed, collision radii, VFX/SFX, room progression, or input semantics change.
- No new networking code, room code, P2 object, prediction, snapshots, or synchronization code.
- Existing touch and keyboard behavior remains identical.
- Existing public Scene hooks remain available where current runtimes/tests depend on them.
- The final single-player Scene has exactly one player source of truth: `scene.localPlayer`.

## Completion criteria

- No production file under `web/src/lib/games/dungeon/` references the legacy Scene player aliases except compatibility/static-test text if needed.
- `attachLocalPlayerEntity` no longer installs alias getters/setters.
- All targeted runtimes accept/capture an explicit `PlayerEntity` and use its fields.
- Existing single-player behavior contracts pass unchanged.
- Full `make test` passes, including Svelte production build and Go tests.
