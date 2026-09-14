# Dungeon Weapon Identity 2.0 Design

## Goal

Make melee, bow, and staff all viable the moment the player equips them. Weapon identity must come from deterministic baseline mechanics, while affixes add variation and power instead of deciding whether a weapon is fun at all.

The first implementation should improve balance without adding active-skill buttons, mana, aim-mode UI, or new input complexity.

## Current Problems

1. Bow and staff start below melee in raw sustained damage. With the current profiles, sword is the 1.00 baseline, bow is about 0.845, and staff is about 0.836 before projectile losses.
2. Bow and staff projectiles can be destroyed by room geometry, while melee auto-attack can currently resolve damage based on distance without equivalent wall blocking.
3. Ranged projectiles are coupled too tightly to their original target. If the target dies before impact, the projectile can expire instead of continuing naturally through the world.
4. Staff identity is mostly a slow homing orb. Bow identity is mostly a normal arrow. Their interesting skills are hidden behind proc/build affixes.
5. `volley` and `arcane_nova` are effectively skill unlocks instead of modifiers of an already-useful weapon.
6. Ordinary weapon generation currently rolls only dagger, sword, and katana. Bow and staff are not first-class ordinary drops.
7. The legendary catalog is melee-only, so late-game rewards reinforce the same bias.
8. VFX inventory is underused. Multiple asset packs exist, but filename-only classification leaves entire packs unclassified.

## Design Principles

- No active-skill button.
- No mana system in this iteration.
- Weapon identity is deterministic, not RNG-driven.
- Affix RNG may amplify, transform, or specialize a weapon, but must not unlock the basic fun.
- Balance targets long-term expected output, not isolated hit damage.
- Ranged weapons may gain tactical advantages from distance, piercing, homing, area damage, and control, so their single-target output should not greatly exceed melee.
- Walls are real for every archetype. Fairness comes from consistent targeting and collision rules, not by letting everything hit through geometry.
- Existing resource-only combat VFX rule remains: combat VFX must use loaded art assets; no procedural Phaser geometry fallback.

## Baseline Balance Budget

Use standard sword as the sustained single-target baseline of 100%.

| Archetype | Raw baseline | Deterministic identity target | Group target |
| --- | ---: | ---: | ---: |
| Melee | 100% | 100-110% | 100-110% |
| Bow | ~85% | 95-105% | 110-115% when positioning is good |
| Staff | ~84% | 98-108% | 115-130% in clustered fights |

The intent is not exact equality on every encounter. Melee should remain the most immediate and reliable. Bow should reward line-up and range. Staff should reward control and clustered enemies.

## Bow Identity

### Base attack

Keep the current fast physical arrow projectile and long range. Bow arrows remain straight-line projectiles and do not home.

A fired arrow should continue through the world independently of whether its original target is still alive. It should collide with the first valid enemy along its path, room geometry, or lifetime expiry.

### Signature cadence

Every fourth valid bow attack becomes a **Power Shot**.

A valid bow attack means the player had a valid line-of-sight target when the arrow was launched. Progress is counted on launch so the fourth shot has an obvious firing rhythm and VFX.

### Power Shot numbers

- Primary hit: `160% weapon damage`.
- Natural penetration: continue after the first enemy and allow one additional enemy hit.
- Secondary penetration hit: `70% weapon damage`.
- No additional proc recursion from the secondary penetration hit.
- The Power Shot uses a stronger arrow launch/impact treatment but still uses the real arrow sprite.

With the current bow attack-speed and damage multipliers, the extra 60% damage every fourth shot raises single-target sustained output from roughly 84.5% of sword to roughly 97%, before tactical range benefits.

### Bow affix behavior

`volley` is no longer a chance to unlock the bow's identity. It becomes a deterministic modifier of the fourth-shot signature.

When a bow has `volley`, Power Shot also launches secondary real-arrow projectiles toward nearby valid targets. The affix value scales the secondary volley damage. These projectiles:

- use real arrow art;
- do not heal;
- do not recursively trigger build procs;
- do not consume extra signature progress.

`piercing` continues to improve bow multi-target pressure, but Power Shot always has its one guaranteed penetration even without the affix.

## Staff Identity

### Base attack

Keep the current homing spell projectile as the staff's normal attack. Every staff hit should use a small, inexpensive arcane impact/spark visual so the weapon feels magical even before a signature fires.

If the staff projectile's target dies before impact, the projectile may reacquire one nearby visible enemy rather than immediately expiring.

Reacquisition constraints:

- small local search radius, approximately 180 px;
- target must be alive;
- target must be reachable without crossing solid room geometry;
- only one current target at a time;
- no teleporting projectile position.

### Signature cadence

Every third **successful staff hit** releases the staff's signature spell.

Only a real hit advances and consumes staff signature progress. Shooting into a wall or losing every valid target does not waste the third-hit signature.

Signature progress resets when the equipped weapon changes.

### Signature field

Weapon items may carry:

`signature: 'arcane_burst' | 'storm_palm' | 'frost_blizzard'`

For ordinary staff drops in the first version:

- Arcane Burst: 40%
- Storm Palm: 30%
- Frost Blizzard: 30%

A missing staff signature falls back to `arcane_burst` for compatibility with existing items.

### Arcane Burst

The baseline staff signature and balance reference.

On the third successful hit:

- primary target receives `+60% weapon damage`;
- enemies within approximately 88 px of the primary receive `35% weapon damage`;
- signature damage does not recursively trigger another signature;
- use arcane/sparkle/explosion resource VFX.

The +60% primary bonus every third staff hit raises current staff single-target output from roughly 83.6% of sword to roughly 100%.

### Storm Palm

A deterministic compact lightning spell, separate from the random `thunder` build affix.

On the third successful hit:

- primary target receives `+60% weapon damage`;
- chain to at most two additional visible enemies;
- first chain hit: `35% weapon damage`;
- second chain hit: `20% weapon damage`;
- every lightning segment uses resource-backed lightning VFX;
- chain damage cannot recursively proc the signature.

This is intended to be a frequent readable staff spell, not a full-screen storm.

### Frost Blizzard

A deterministic control/AOE staff spell.

On the third successful hit:

- create a resource-backed blizzard area centered near the primary target;
- radius approximately 92 px;
- duration approximately 1.2 seconds;
- 3 damage ticks;
- if the primary stays for the full duration, total bonus damage is approximately `60% weapon damage`;
- other enemies inside receive the same tick model;
- enemies inside are slowed by approximately 22%;
- slow ends when the effect expires unless refreshed by a later blizzard.

The single-target budget remains close to Arcane Burst, while grouped fights produce the staff's intended advantage.

## Melee Fairness

Do not buff ranged weapons by making them ignore walls.

Instead, melee attacks must respect solid room geometry too.

A melee target is valid only when:

- it is alive;
- it is within weapon range;
- the attack path/attack region is not blocked by solid room geometry.

Spear and long-reach melee weapons may still reach farther than swords, but they cannot stab through a solid wall.

No broad melee redesign is required in this phase; the change is specifically to remove unfair wall penetration and use the same attackability concept shared by ranged targeting.

## Target Selection and Collision

Introduce one shared concept: **attackable target**.

Auto-target selection should prefer the nearest alive target that is actually attackable by the current weapon.

For bow/staff, that means line-of-sight/path validity to the target before firing. For melee, that means range plus solid-geometry blocking.

This prevents repeated attacks into walls while another valid enemy is available.

Projectile collision behavior:

- Bow: straight-line world projectile; target-independent after launch; may hit another enemy naturally.
- Staff: homing world projectile; may reacquire one nearby visible target if its current target dies.
- Both: stop on solid geometry unless a future explicit weapon mechanic says otherwise.

## Ordinary Weapon Drops

Promote bow and staff to first-class ordinary drops.

Top-level archetype weight:

- Melee family: 60%
- Bow: 20%
- Staff: 20%

For the first implementation, preserve the current melee sub-distribution among dagger/sword/katana rather than introducing new ordinary greatsword/spear/axe drop behavior in the same change.

Existing rarity, damage, depth bonus, and affix-slot rules remain unchanged.

Staff generation additionally rolls the deterministic `signature` field using the 40/30/30 distribution above.

Bow uses `power_shot` as its built-in signature and does not need a stored signature field in the first version unless a future legendary overrides it.

## Affix Migration

The existing affix system remains, but build affixes stop acting as basic skill unlocks.

### `volley`

Bow-only specialization behavior remains. It augments Power Shot with secondary arrows rather than being the only way to get a special bow attack.

### `arcane_nova`

Staff-only specialization behavior remains. It augments any staff signature by adding a small nova around the signature's primary impact point.

Recommended first-pass behavior:

- nova bonus damage budget scales from the rolled affix value;
- resource-only VFX;
- no recursive signature/proc loops.

### `whirlwind`

Keep current melee behavior for this phase. It remains a melee build affix. A future melee identity pass can decide whether melee also needs a deterministic cadence mechanic, but it is explicitly out of scope here.

### `thunder`

Keep the restored current semantics in this phase: it remains a rare random build effect rather than becoming the staff's baseline lightning identity.

Storm Palm is deterministic and compact. `thunder` is random and exceptional. They are intentionally different systems.

### `skill_radius`

Affects staff signature AOE radius where applicable, including Arcane Burst, Frost Blizzard, and Arcane Nova augmentation.

### `skill_haste`

Does not reduce the deterministic hit-count cadence in the first version. Attack-speed already increases how often deterministic signatures occur. Letting `skill_haste` also reduce hit count would double-dip and make high-attack-speed builds unstable.

Existing timed skills may continue using `skill_haste` until their system is revisited separately.

## Legendary Weapons

The current legendary catalog is melee-only. That is not acceptable as the final Weapon Identity 2.0 state, but expanding the entire legendary content set should not block the core balance fix.

Implementation is split into two milestones:

1. Core weapon identity, ordinary drops, targeting/collision fairness, affix migration, and VFX availability.
2. Add at least one bow legendary and one staff legendary using the same deterministic signature system, then expand content in later balancing passes.

No legendary may require an active-skill button.

## VFX Asset Availability

The repository already contains multiple VFX packs, but current classification is too dependent on the final filename.

The classifier should be improved so VFX discovery can use more context:

- full relative asset path, not only basename;
- source-pack identity;
- pack-specific classification rules where needed.

The goal is not to blindly classify every transparent PNG. The goal is to stop silently producing zero usable assets from known VFX packs.

Minimum requirements:

- Lightning pack produces lightning assets reliably.
- Foozle and free-pixel-magic packs must be inspected and either classified with explicit rules or intentionally excluded with documented reasons; silent zero classification is not acceptable.
- Retro Impact extraction must be made reproducible in CI or the archive should be converted/repackaged into a supported format in a later asset-only change.
- New signature VFX may only use assets present in the generated manifest.

## State and Data Flow

Signature runtime state belongs to the player's current weapon-combat runtime, not to permanent player progression.

Required runtime state:

- bow valid-shot counter modulo 4;
- staff successful-hit counter modulo 3;
- current equipped weapon identity/signature key;
- active Frost Blizzard areas and their remaining lifetime;
- existing projectile state.

When the equipped weapon identity changes, signature progress resets.

Secondary signature damage uses explicit context flags so it does not:

- advance signature counters;
- trigger itself recursively;
- heal from direct-hit-only effects unless explicitly intended;
- create recursive chain/volley explosions.

## Testing Strategy

Implementation must be test-driven.

Minimum regression coverage:

1. Bow fourth valid shot is always Power Shot; no RNG is involved.
2. Bow Power Shot primary damage is 160% and guaranteed penetration can hit one second enemy.
3. Normal bow arrows continue after their original target dies and can hit another enemy on path.
4. Bow projectiles still stop on solid geometry.
5. Staff signature fires on every third successful hit and not on misses/blocked shots.
6. Staff progress resets on weapon change.
7. Arcane Burst primary bonus and splash targets match the specified budget.
8. Storm Palm hits the primary plus at most two additional targets with 60/35/20 damage scaling.
9. Frost Blizzard applies three ticks, expected total damage, radius behavior, and temporary slow.
10. Staff projectile target death triggers bounded visible-target reacquisition instead of immediate expiry.
11. Auto-targeting ignores enemies blocked by walls when another attackable target exists.
12. Melee cannot damage through solid room geometry.
13. Ordinary drop generation includes approximately 60/20/20 melee/bow/staff weighting in deterministic distribution tests.
14. Staff drop signatures follow the configured 40/30/30 distribution under deterministic random fixtures.
15. `volley` and `arcane_nova` augment deterministic signatures instead of acting as the only unlock path.
16. Signature secondary damage cannot recursively proc signatures.
17. Combat VFX remain resource-only.
18. VFX manifest generation no longer silently drops known supported packs without an explicit test expectation.
19. Production web build succeeds.

## Acceptance Criteria

The change is ready when all of the following are true:

- A common bow with no build affix has a visible, deterministic special rhythm and is not a clear DPS downgrade from a common sword.
- A common staff with no build affix automatically performs Arcane, Storm, or Frost signature magic and is not a clear DPS downgrade from a common sword.
- Grouped fights make staff visibly stronger than its single-target baseline without making boss damage excessive.
- Bow rewards enemy line-up and range without exceeding melee single-target output by default.
- Neither ranged nor melee auto-attacks repeatedly damage/target through solid walls.
- Ranged projectiles behave like world objects instead of disposable messages to one target.
- Ordinary gameplay can actually drop bow and staff weapons.
- Existing build affixes remain valuable as modifiers rather than required fun unlocks.
- No active-skill UI, mana system, or new control scheme is introduced.
- No procedural combat VFX fallback is reintroduced.

## Explicit Non-Goals

- Active skill buttons.
- Mana or energy resources.
- Full melee archetype redesign.
- Rebalancing every legendary in the same core implementation.
- New multiplayer protocol work.
- Procedurally drawn combat VFX.
