# Dungeon Enemy Feedback Design

## Goal

Make enemy hits, deaths, and boss warnings readable and satisfying without changing combat math, enemy AI decisions, drop rates, floor progression, or encounter timing.

## Scope

This pass owns four presentation concerns:

1. Directional hit reaction for living enemies.
2. Short death presentation before enemy visuals are destroyed.
3. Corpse disappearance that reads as a death rather than an instant hide.
4. Stronger boss charge and shockwave telegraphs while preserving their existing damage timing and cooldowns.

## Architecture

Keep gameplay state in `scene.js` and `attack-runtime.js`, but move presentation policy into a focused `enemy-feedback-runtime.js`. The runtime exposes pure presentation profiles plus small Phaser-facing helpers. `attack-runtime.js` invokes hit/death feedback after the original damage calculation, while boss telegraph helpers are installed as wrappers around the existing `bossCharge` and `bossShockwave` methods.

No new texture packs are required. Reuse existing sprites, tweens, shapes, and the current VFX runtime. Keep temporary object counts bounded for iPad performance.

## Hit Feedback

A living enemy hit gets a short directional recoil based on the vector from the attack origin to the enemy. The visual sprite may offset a few pixels and briefly squash/stretch, but the authoritative `enemy.x/y` remains controlled by the existing knockback/collision logic. Boss recoil is intentionally smaller than normal/elite recoil.

Existing tint flash, hit stop, camera shake, and numeric knockback remain intact.

## Death Feedback

Do not immediately hide the enemy sprite. On death, disable further gameplay participation through the existing `hp <= 0` state, remove the health bar immediately, then animate the visual for a bounded 180–300 ms window.

Normal enemies: quick recoil, slight squash, fade and shrink.
Elite enemies: stronger scale accent and slightly longer fade.
Boss: heavier short pause/scale accent and longer fade, still bounded.

The existing debris burst remains, but normal kills should use impact/death presentation rather than treating every kill as a full explosion. `corpse_burst` remains the explicit explosion + smoke case.

## Boss Telegraphs

Charge keeps the existing 420 ms wind-up and 560 ms charge duration. Improve the warning with a clearer lane: wide translucent danger band plus bright center line, both anchored from boss to the current target direction. Do not add persistent particles.

Shockwave keeps the existing 560 ms wind-up and current damage radius. Improve readability with an inner fill plus two staged rings so the player can read both origin and final danger radius before damage resolves.

Phase II may use stronger alpha/stroke, but timing and damage stay unchanged.

## Performance Constraints

- No per-frame particle emitters.
- No unbounded tween loops for hit/death effects.
- At most a handful of temporary shapes per boss telegraph.
- Reuse existing VFX categories rather than loading more assets.
- Destroy all temporary objects at tween completion or scene shutdown.

## Testing

Add pure tests for hit/death presentation profiles and runtime tests with small Phaser stubs verifying:

- normal/elite/boss reactions scale in the intended order;
- death visuals stay visible long enough to animate, then destroy;
- normal kills do not request explosion while corpse burst does;
- charge and shockwave telegraph profiles preserve the existing 420/560 ms timings and bounded object counts.
