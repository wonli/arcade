# Dungeon Boss Combat Presentation Design

## Goal

Turn the existing Dungeon boss actions into readable, weighty combat moments without changing combat math, AI decisions, cooldowns, damage, or the existing 420 ms charge / 560 ms shockwave windups.

## Approach

Extend `enemy-feedback-runtime.js` as the presentation boundary. Keep `scene.js` authoritative for boss state and gameplay. The feedback runtime observes/wraps existing boss actions and receives explicit phase/player-hit presentation events through a tiny API.

## Charge

During the existing 420 ms charge warning, compress the boss slightly and bias its visual backward from the target direction. When the original charge begins, restore the base pose and apply a short directional stretch. The existing charge warning lane remains bounded and uses no particle loop.

## Shockwave

During the existing 560 ms warning, make the boss visibly gather force with a short scale pulse. At release, add a brief stomp/squash accent synchronized with the existing ring and damage resolution. No gameplay radius or damage changes.

## Phase II

On the existing phase 1 -> 2 transition, add one bounded ~300 ms visual burst: scale pulse, aura/ring accent, then settle. Keep the current tint as the persistent lightweight phase marker. No persistent emitters.

## Boss Hit on Player

Expose `playerHit({ boss, damage })` in the feedback runtime. Boss-origin damage gets a stronger but capped camera/visual accent than normal contact. The gameplay `hitPlayer` implementation remains responsible for HP and death.

## Performance

No per-frame particle emitters. Temporary shapes are capped. All tweens are bounded and destroyed/completed. Existing VFX assets are reused; no new asset pack is loaded.

## Testing

Pure profiles cover charge/shockwave/phase/player-hit presentation strengths and timing. Runtime tests verify wrappers delegate original boss gameplay exactly once and presentation never mutates boss HP, cooldown fields, phase thresholds, or player HP.
