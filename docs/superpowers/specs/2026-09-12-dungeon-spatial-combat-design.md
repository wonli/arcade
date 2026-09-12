# Dungeon Spatial Combat Design

Date: 2026-09-12

## Goal

Upgrade the dungeon from a mostly decorative arena into a spatial combat system where room geometry, hazards, obstacles, lighting, interactables, enemy navigation, and attack presentation all materially affect play.

This slice also corrects the current affix/skill presentation problem where some visual effects are attached to hit targets instead of originating from the player attack itself.

The intended outcome is that the player can understand attacks from motion and shape alone: piercing comes from the player forward, whirlwind revolves around the player, thunder visibly chains outward from the first strike, and explosions read as spatial events rather than generic hit decoration.

## Design direction

Keep the existing Phaser scene, combat formulas, affix data, endless chapter progression, loot rules, pickup interaction, and current assets.

Do not rewrite the game into a full ECS.

Instead introduce two explicit layers:

1. `Room Geometry` — authored/testable room-space descriptions that define walls, obstacles, hazards, decorations, interactables, spawn zones, and navigation cells.
2. `Attack Effect` — attack-space descriptions emitted from the attacker position and facing, then resolved into hits and rendered with skill-specific visuals.

Runtime Phaser code consumes these layers. Combat math remains the source of damage numbers, while Attack Effect geometry becomes the source of where an attack exists in space.

## Spatial room model

A room descriptor contains at least:

- `id`
- `boundary`
- `walls`
- `obstacles`
- `hazards`
- `decorations`
- `interactables`
- `playerSpawn`
- `enemySpawnZones`
- `navigationGrid`

The existing `pillars`, `blocks`, `torches`, and `spawnPoints` concepts should migrate into this model rather than being discarded.

### Walls

Walls are hard collision geometry.

Player and enemies cannot walk through them.

Attacks may be blocked by walls depending on attack type. The first implementation should block normal melee traces, projectiles, and piercing beams at walls. Future affixes may opt into wall penetration, but that is out of scope for this slice.

Outer room boundaries remain solid.

### Obstacles

Obstacles include pillars, broken walls, statues, crates, and other solid cover.

They are hard collision for both player and enemies.

They participate in navigation and line-of-sight blocking.

They should not all be rectangles visually, but collision may use rectangles/circles in v1.

### Water hazards

Water is traversable rather than solid.

Entering water applies a movement-speed multiplier to both player and normal enemies.

Recommended v1 multiplier: `0.68`.

Bosses may receive a reduced slow, recommended `0.85`, so they remain threatening while the terrain still matters.

The slow comes from current position, not a timed debuff that persists after leaving the water.

Water should have a readable edge, subtle animated shimmer/ripple, and slightly darker/cooler floor treatment.

### Future hazards

The room model should allow hazard kinds beyond water, but v1 only needs water as gameplay terrain.

Fire floor, traps, poison, ice, moving hazards, and destructible terrain are non-goals for this slice.

## Room templates

Replace the simple modulo rotation of three layouts with an authored template pool.

First-version template targets:

- `open-hall` — broad fighting space, sparse pillars.
- `cross-gallery` — central lanes with blockers and side routes.
- `broken-ruins` — offset walls creating cover and flanking paths.
- `twin-pools` — two water zones that shape movement and ranged lines.
- `pillar-field` — multiple circular blockers with open diagonal lanes.
- `narrow-sanctum` — long central fighting lane with side alcoves.

Each template must preserve at least one connected player-to-exit path.

No room should create a permanent trap pocket that monsters or the player can enter but not leave.

Room templates may be selected by absolute floor / chapter with light randomness, but the geometry for a floor should remain stable once generated.

## Navigation

Enemies must obey walls and solid obstacles.

Direct velocity-to-player behavior is no longer sufficient once rooms contain meaningful geometry.

Use lightweight grid navigation rather than a heavy general navmesh system.

### Navigation grid

Build a low-resolution walkability grid from the room descriptor.

Recommended cell size: 32 or 48 pixels, aligned closely with the existing tile scale.

Cells are classified as:

- walkable
- blocked
- water

Water remains walkable with increased traversal cost.

### Enemy pathfinding

Use A* or equivalent shortest-path grid search.

Pathfinding should not run from scratch every frame for every monster.

Recommended runtime contract:

- Repath when the target cell changes materially.
- Repath when the current path becomes invalid.
- Repath on a staggered interval, approximately 250-500 ms depending on enemy count.
- Reuse/cache paths where practical for enemies sharing nearby start/target cells.
- Local steering handles short-range separation so enemies do not occupy exactly the same point.

Fast enemies may use shorter repath intervals.

Ranged enemies should path toward their preferred-range band instead of always pathing directly onto the player's cell.

Bosses use the same collision/navigation rules, but charge attacks may follow a straight telegraphed path until colliding with a wall/obstacle.

### Navigation failure fallback

If a path cannot be found, an enemy should not phase through geometry.

It may move toward the nearest reachable grid cell to the target or pause/repath.

## Collision contract

The player, enemies, enemy projectiles, player projectiles/beams, and room solids share one consistent collision model.

Important rules:

- Player vs wall/obstacle: blocked.
- Enemy vs wall/obstacle: blocked.
- Enemy projectile vs wall/obstacle: destroyed on impact.
- Player piercing beam vs wall/obstacle: terminates at first blocking surface.
- Melee arc vs wall: attack visual may clip/stop at geometry and cannot damage enemies through solid walls.
- Whirlwind: radial area is centered on the player, but line-of-sight to a target should be required if a wall fully separates target and player.
- Thunder chain: each chain segment requires a valid unobstructed link in v1.

## Interactables and treasure chests

Rooms may contain treasure chests.

Chests are not automatic pickups.

Player approaches the chest and presses `E` to open it, matching the current explicit weapon-equip interaction language.

A chest can be opened once.

Opening should include:

- short lid/pop animation or squash effect
- warm flash
- small particle burst
- loot fan-out onto nearby valid floor positions

Loot uses existing equipment and potion systems.

### Chest placement

Chests must spawn on reachable walkable cells.

They must not block the mandatory player-to-exit path.

They should usually sit in side spaces, alcoves, behind mild positional risk, or near arena edges rather than directly under the player spawn.

### Chest quality

Suggested v1 rules:

- Combat floor: low chance for a normal chest.
- Elite floor: materially higher chest chance and quality.
- Boss floor: guaranteed strong chest or boss reward presentation using the chest system.
- Rest floor: no combat chest; the existing rest interaction remains the room reward.

Fortune may improve chest reward quality but does not guarantee Epic.

## Torch and atmosphere presentation

Torches remain decorations, but their presentation should become richer.

A torch consists of:

- visible fixture
- small flame sprite/shape
- flickering glow
- local floor light tint / additive halo
- occasional ember particle

Torch light is visual only in v1 and does not affect enemy vision or stealth.

Torches should help communicate walls, corners, and playable space.

## Attack Effect model

Combat attacks should be described spatially before hit presentation.

Suggested pure data shape:

```js
{
  kind: 'beam' | 'arc' | 'radial' | 'projectile' | 'chain' | 'burst',
  origin: { x, y },
  direction: { x, y },
  range,
  radius,
  width,
  duration,
  blocksOnSolids,
  source: 'basic' | 'piercing' | 'whirlwind' | 'thunder' | 'corpse_burst' | 'skill',
}
```

The exact type structure can differ in implementation, but the architectural rule is strict:

**Attack geometry originates from the attacker, not from the victim.**

Hit targets are outputs of resolving the geometry against enemies and room collision.

## Player facing and attack origin

The player's current facing direction is authoritative when an attack begins.

Basic attacks and active skill effects should snapshot their origin/facing at attack time rather than following the player after launch.

For auto-attack against a target, facing may first rotate toward the selected target before the attack geometry is created.

The visual start point should sit slightly in front of the player sprite / weapon hand rather than at the sprite center when practical.

## Basic attack presentation

Basic melee attacks should feel like a swing rather than invisible damage.

V1 presentation:

- short wind-up
- forward arc/slash trail
- clear contact spark on hit
- very short hit-stop on successful direct hit
- mild enemy knockback

Recommended hit-stop target: approximately 30-55 ms for normal hits.

Critical hit may use approximately 55-80 ms, stronger white/yellow flash, and a slightly larger camera shake.

Hit-stop must pause combat presentation cleanly without creating permanent timer drift.

## Piercing effect

Current behavior where piercing presentation appears around/above a target is replaced.

Piercing is a forward attack emitted from the player.

V1 behavior:

1. Determine attack facing toward the auto-attack target.
2. Start a narrow beam/slash trace slightly in front of the player.
3. Extend forward until maximum range or first solid wall/obstacle.
4. Resolve every enemy intersecting the beam, ordered by distance from player.
5. Apply the existing piercing combat rule to valid secondary targets.
6. Render one continuous beam/trail, not separate disconnected target lines.

Visual layers:

- bright core
- softer outer trail
- brief muzzle/start flash
- hit spark at each intersected enemy
- short fading afterimage

This should visually explain why multiple enemies were hit.

## Whirlwind effect

Whirlwind is centered on the player.

It must never render as a circle centered on an enemy.

V1 behavior:

- player is the pivot
- one fast 360-degree sweep around the player
- radial hit resolution against enemies inside the configured radius
- solid-wall line-of-sight check prevents hitting through a separating wall

Visual layers:

- 2-3 rotating crescent trails
- expanding faint ring
- dust/air pixels near the perimeter
- contact sparks where enemies are hit

The animation should read as rotation around the character, not an expanding explosion.

## Thunder effect

Thunder remains target-chain based, but the source chain must be readable.

V1 chain:

`player/weapon -> primary target -> secondary target -> ...`

The first segment originates from the attack source.

Each later segment originates from the previous struck target.

Use jagged multi-segment lightning with a brief white-blue impact flash at each node.

Chain segments must respect solid geometry in v1.

## Corpse Burst effect

Corpse Burst remains enemy-death centered because the corpse is the actual source.

This is the intentional exception to the attacker-origin rule.

Presentation stages:

1. compact bright center flash
2. expanding orange-red shock ring
3. radial debris/shards
4. brief floor scorch/fade mark if cheap to render

The effect should clearly read as a death-triggered explosion rather than a generic damage number.

## Active skill presentation

The existing Space skill should use the same Attack Effect infrastructure.

Its geometry may remain radial in v1, but it must be explicitly player-centered and visually distinct from Whirlwind.

Suggested distinction:

- Active skill: one heavy expanding shockwave pulse.
- Whirlwind: fast rotational crescents orbiting the player.

This prevents two mechanics from sharing the same visual language.

## Knockback and hit reaction

Normal enemies receive small knockback from direct melee hits.

Fast enemies may receive slightly more displacement but recover quickly.

Brutes receive reduced displacement.

Bosses receive little or no physical displacement, but should still flash/react so hits feel acknowledged.

Knockback must respect solids and cannot push entities through walls.

Ranged enemies should briefly interrupt strafing on a meaningful hit.

## Camera and screen feedback

Use camera shake sparingly and hierarchically:

- normal direct hit: usually none or near-zero
- critical: mild
- Whirlwind multi-hit: mild one-time pulse, not one shake per enemy
- Corpse Burst: local moderate pulse
- Boss heavy skill impact: strongest allowed shake

Avoid stacking N camera shakes when one AoE hits N enemies.

## Runtime module boundaries

Recommended responsibilities:

- `room-geometry.js`
  - pure room templates
  - geometry descriptors
  - water / solid definitions
  - reachable placement helpers

- `navigation.js`
  - grid construction
  - A* search
  - traversal cost
  - path smoothing/basic steering helpers

- `attack-effects.js`
  - pure attack geometry creation
  - beam/arc/radial/chain intersection helpers
  - wall blocking / line-of-sight

- `spatial-runtime.js`
  - Phaser room collision bodies
  - hazard checks
  - chest runtime
  - torch visuals

- `combat-runtime.js` or focused additions to existing runtime modules
  - player-origin skill presentation
  - hit-stop
  - knockback
  - impact feedback

- `scene.js`
  - orchestration only
  - avoid growing geometry/pathfinding/effect math directly inside the already-large scene file

Existing `combat.js` remains responsible for damage and build stat logic where possible.

Existing `visuals.js` should either consume the new Attack Effect events or be split so old victim-attached wrappers do not continue to produce conflicting effects.

## Event flow

Recommended attack flow:

1. Decide target / facing.
2. Create Attack Effect geometry from player position.
3. Clip geometry against solid room collision.
4. Resolve intersected enemies.
5. Run existing combat math for each valid hit.
6. Emit structured combat outcome event(s).
7. Render skill-specific attack trail plus impact feedback.
8. Apply knockback/hit-stop where appropriate.

This separates geometry, damage, and visuals while keeping them synchronized.

## Chest interaction flow

1. Generate reachable chest placement from current room geometry.
2. Render closed chest.
3. When player enters interaction range, show `E Open / E 打开` hint.
4. On `E`, mark chest opened exactly once.
5. Play open effect.
6. Roll loot using current floor/chapter/room role/Fortune context.
7. Spawn loot on nearby reachable points.
8. Existing weapon E-to-equip and potion auto-pickup rules continue unchanged.

## Room generation and infinite chapters

The recently added infinite Chapter system remains the progression owner.

Room geometry is selected after room role is known.

Room role may influence templates and contents:

- Combat: broad template pool.
- Elite: favors more tactically constrained layouts but must remain readable.
- Rest: uses dedicated calm/rest geometry, no hostile hazards.
- Boss: favors larger readable space with fewer small blockers so boss mechanics remain fair.

Chapter length remains random 4-8.

No change to the core Chapter contract is required in this slice.

## Testing strategy

Follow TDD.

Pure tests first for:

1. Every room template preserves connected walkable space between player spawn and exit zone.
2. Chest placement is reachable and does not overlap solids.
3. Water cells are walkable with higher traversal cost.
4. Solid cells are not traversable.
5. A* routes around walls/obstacles rather than crossing them.
6. Ranged preferred-range target selection returns reachable positions when possible.
7. Beam geometry starts at player origin and follows facing.
8. Beam terminates at first solid blocker.
9. Beam returns multiple enemies ordered along the trace.
10. Whirlwind geometry is centered on player and respects wall line-of-sight.
11. Thunder first segment starts from player, later segments chain target-to-target.
12. Corpse Burst remains corpse-centered.
13. Knockback cannot move an enemy through a solid.
14. Water slow applies only while inside water.
15. Chest can open exactly once.
16. Chest reward quality respects Combat/Elite/Boss/Fortune context.
17. Existing E-to-equip weapon behavior remains intact.
18. Existing potion auto-pickup remains intact.

Then runtime/build verification.

## Delivery order

Implement this as incremental playable slices rather than one giant scene rewrite.

Recommended order:

1. Room geometry + collision + water.
2. Enemy grid pathfinding around solids.
3. Chest interaction and richer torches.
4. Attack Effect geometry for piercing / whirlwind / thunder.
5. Hit-stop / knockback / impact feedback.
6. Integrate active skill and cleanup old victim-attached VFX paths.
7. Expand room template pool and tune difficulty/readability.

Each slice should leave the game playable and CI green.

## Non-goals

Do not add in this slice:

- procedural tile-by-tile maze generation
- destructible walls
- pushable crates
- traps beyond water
- stealth/light detection
- physics-based rigid body combat
- full ECS migration
- inventory/backpack
- currency/shop economy
- branching dungeon map selection
- network multiplayer

## Success criteria

The dungeon should feel spatial rather than like a flat arena with decorations.

Players and monsters must route around walls and obstacles.

Water must visibly and mechanically influence positioning.

Torches, obstacles, and geometry must make rooms visually readable.

Treasure chests must provide a clear optional exploration/reward interaction.

Piercing must visibly originate from the player and travel forward through multiple enemies until blocked.

Whirlwind must visibly rotate around the player.

Thunder must visibly chain from player to first target, then between targets.

Combat hits must feel more physical through attack trails, impact feedback, brief hit-stop, and restrained knockback.

Existing endless Chapter progression, affix logic, loot rarity, E-to-equip weapons, and potion auto-pickup must continue working.
