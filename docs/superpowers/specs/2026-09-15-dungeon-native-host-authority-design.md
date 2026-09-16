# Dungeon Native Host Authority Design

## Goal

Replace the current layered Scene monkey-patching model with explicit ownership boundaries for authoritative world state and Phaser presentation, while preserving current single-player behavior and the existing P1-host / P2-guest product model.

## Problems being fixed

The current Dungeon runtime has multiple owners for the same entity lifecycle:

- `pickup-runtime` keeps drop selection and visual state while `world-runtime` can destroy the same drop.
- `world-runtime` directly destroys enemy sprites and health bars while `infinite-runtime` owns elite auras.
- guest world synchronization can create a drop before its named weapon texture is available and never retries presentation.
- floor / portal state is partly produced locally and partly corrected by network facts.
- the multiplayer route duplicates Dungeon UI strings and hard-codes English instead of sharing the single-player locale model.
- old and new networking paths overlap in responsibility.

These ownership conflicts have already produced concrete bugs: P2 pickup crashes in Phaser `setTexture`, missing P2 weapon-drop art, duplicate purple elite auras, divergent floors after transitions/reconnects, and missing locale switching on the multiplayer page.

## Architecture

### 1. Authoritative world facts remain data-only

Host authority owns durable gameplay facts: enemies, drops, portal state, floor/progression and player equipment/HP resulting from authoritative commands. Network messages carry IDs and serializable state only. No Phaser object may appear in world/network state.

The Go/AQI server remains a stateless room/message relay.

### 2. Presentation owns Phaser object lifecycle

Introduce one Dungeon presentation lifecycle boundary. Every world entity has at most one presentation owner responsible for all Phaser objects attached to that entity.

For a drop this includes weapon sprite, glow, label, sparkles, tween state and pickup selection state.

For an enemy this includes sprite, health bar, elite/boss aura and presentation tweens.

For a portal this includes glow, ring and core.

Network/world synchronization may request `upsert`, `remove` or `reconcile`; it must not directly call Phaser `destroy`, `setTexture`, or construct presentation objects.

### 3. Stable IDs instead of stale object references

Transient UI/runtime state refers to durable entities by stable entity ID. In particular pickup selection becomes `selectedDropId`, never a retained drop object whose Phaser visual can be destroyed independently.

### 4. Asset readiness is reconciled

World state and visual readiness are independent. A network drop remains valid even when its named weapon texture is not loaded yet. The presentation layer retries/reconciles when Phaser's loader completes so a late texture produces the missing visual without another network fact.

### 5. Guest does not generate durable world state

The host remains the only source of durable enemy/drop/portal/floor facts. Guest presentation can be bootstrapped locally for the initial canvas, but canonical world state replaces/reconciles it and guest code must not publish or invent durable entities.

### 6. Locale is client-local UI state

Locale is not authoritative and is never synchronized. Single-player and multiplayer share the same Dungeon message catalog/helpers. Each client may independently use `zh-CN` or `en` and persist `arcade.locale` locally.

## Migration scope

This change intentionally does not build a generic Arcade game framework. It only makes Dungeon's current single-player and host-authoritative co-op model structurally sound.

Migration order:

1. add temporary branch CI;
2. centralize Drop lifecycle and selection by ID;
3. centralize Enemy lifecycle including aura/bar cleanup;
4. centralize Portal/Floor presentation boundaries;
5. share Dungeon i18n between single-player and multiplayer pages;
6. remove obsolete Dungeon networking hooks/duplicates that are no longer on the execution path;
7. run the full web test suite and production build in CI.

## Invariants

- one stable entity ID maps to at most one live Phaser presentation;
- removing an entity destroys every presentation object owned by that entity exactly once;
- presentation code may read world data but cannot create authoritative facts;
- network/world code cannot retain Phaser object references;
- guest reconciliation is idempotent;
- asset load order cannot change durable world state;
- single-player remains functional without WebSocket transport;
- multiplayer locale remains independent per browser/client.

## Regression coverage

Required tests must cover:

- removing the currently selected network drop does not touch a destroyed visual on the next update;
- a network weapon drop created before its texture exists receives a visual after loader completion/reconcile;
- removing/replacing an elite enemy destroys its aura together with sprite/bar and leaves no orphan presentation;
- repeated application of the same portal/world state does not create duplicate portal presentation;
- guest floor application does not leave presentation from the previous floor;
- multiplayer Dungeon uses the shared locale catalog and can switch/persist locale;
- existing world synchronization, reconnect and floor-transition tests remain green.
