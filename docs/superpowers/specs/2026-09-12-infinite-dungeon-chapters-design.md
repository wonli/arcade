# Infinite Dungeon Chapters Design

Date: 2026-09-12

## Goal

Upgrade the current five-floor Dungeon Run into an endless chapter-based dungeon while preserving the existing combat, loot, affix, portal, boss, and pickup systems.

The run no longer has a fixed completion floor. Death is the only terminal state.

This change also moves weapon comparison from the page HUD into a vertical, role-following in-game panel near the player.

## Player-facing loop

A run consists of Chapters. Each Chapter contains a random 4-8 floors.

The Chapter is authored at Chapter start so its structure is stable for that Chapter instead of re-rolling on every transition.

The final floor of every Chapter is always a Boss floor.

The floors before the Boss are generated from these room roles:

- Combat: standard enemy wave.
- Elite: stronger wave with elevated reward quality.
- Rest: no enemies; the player chooses one of three recovery/upgrade options.

A Chapter may contain 0-1 Rest floor.

A Rest floor must not be the first floor in a Chapter and should not be directly adjacent to the Boss floor when another valid placement exists.

The generator should prefer Combat floors, use Elite floors sparingly, and insert Rest floors as pacing breaks rather than guarantees.

Example valid Chapters:

- Combat -> Combat -> Elite -> Rest -> Combat -> Boss
- Combat -> Rest -> Combat -> Combat -> Elite -> Combat -> Boss
- Combat -> Elite -> Combat -> Boss

## Global progression model

The game tracks at least:

- `floor`: absolute floor number across the entire run, starting at 1.
- `chapter`: chapter number, starting at 1.
- `chapterFloor`: 1-based floor index inside the current Chapter.
- `chapterLength`: random integer in [4, 8] generated at Chapter start.
- `roomRole`: `combat | elite | rest | boss`.
- `chapterPlan`: stable ordered roles for the current Chapter.

The absolute floor number never resets.

After defeating the Chapter Boss, the normal portal opens and advances into the next Chapter. A new 4-8 floor Chapter plan is generated only when entering that new Chapter.

The previous `runComplete` / five-floor completion path is removed from normal play. Existing run completion UI/events should no longer trigger from reaching a floor number.

## Chapter generation

The generator must be pure and testable with injected RNG.

Rules:

1. Pick `chapterLength` uniformly or near-uniformly from 4-8.
2. Reserve the final slot for `boss`.
3. Fill remaining slots primarily with `combat`.
4. Choose a small number of `elite` floors based on Chapter length and Chapter number, with at least zero and normally no more than two in the first implementation.
5. Roll 0-1 Rest floor.
6. A Rest floor cannot be at position 1.
7. Prefer not to place Rest at `chapterLength - 1`, because that creates Rest -> Boss. If Chapter length leaves no clean placement, omit the Rest floor rather than violate the pacing rule.
8. Rest and Elite assignments must not overwrite the final Boss slot.

The exact weights are implementation detail but the tests must enforce the structural rules above.

## Difficulty scaling

Difficulty scales from absolute floor and Chapter instead of relying on the current five-floor bounds.

Scaling must remain smooth and bounded in density:

- Enemy HP increases continuously with floor.
- Enemy damage/contact damage increases continuously with floor.
- Enemy speed may increase mildly but should use a sensible cap.
- Wave count grows slowly and must have a hard cap so deep floors do not become unreadable or performance-heavy.
- Ranged and stronger archetypes become more common deeper in the run, but the wave remains mixed.
- Elite floors apply an additional difficulty multiplier and elevated elite count.
- Boss HP, damage, charge frequency, and shockwave frequency scale by Chapter with caps where needed.

The first implementation should favor readable combat over exponential stat inflation.

## Loot progression

Loot remains equipment + potion based.

Current rarity classes stay unchanged:

- common
- uncommon
- rare
- epic

Rarity quality improves gradually with depth but probabilities are capped. Epic must never become automatic on normal enemies.

Build affixes become more common at deeper Chapters without making every weapon a Build weapon.

Boss rewards continue to guarantee a strong reward and must keep the current guarantee of at least one Build affix.

Elite floors should have better reward odds than Combat floors.

Rest upgrades do not create inventory items.

## Rest floor

A Rest floor has no enemies and no normal combat clear condition.

On entering a Rest floor:

1. Clear transient combat state/projectiles as on a normal floor transition.
2. Present a visible rest point near the room center.
3. When the player approaches the rest point, show three choices.
4. The player selects exactly one choice.
5. Apply the choice once.
6. Disable the rest interaction.
7. Open the exit portal.

First-version choices:

### Recover

Restore 50% of max HP, clamped to max HP.

If the player is already near full HP this option may still appear; no reroll behavior is required in v1.

### Temper

Strengthen one existing basic affix on the currently equipped weapon.

Rules:

- Only basic numeric affixes are eligible: `power`, `attack_speed`, `critical`, `movement_speed`, `vitality`, `life_steal`.
- Do not generate a new mechanic or Build affix.
- If no eligible affix exists, fall back to a small base weapon damage increase so the option is never dead.
- Recompute derived player stats through the existing equipment/affix derivation path; do not increment already-derived stats directly.

### Fortune

Apply a one-floor reward-quality buff to the next combat-capable floor.

The buff is consumed when that next Combat, Elite, or Boss floor is entered/cleared according to the chosen implementation contract.

The implementation should define a single clear consumption point and test it. It must not persist indefinitely if the next room is another non-combat room in a future extension.

The exact rarity multiplier can be tuned later; v1 should be noticeable but not guarantee Epic.

## Floor transition behavior

Combat floor:

- Spawn standard wave.
- When all enemies die, open portal.

Elite floor:

- Spawn stronger wave / more elites.
- When all enemies die, open portal.

Boss floor:

- Spawn the Chapter Boss encounter.
- When Boss and all required enemies die, open portal.
- Advancing through that portal increments `chapter`, creates a new `chapterPlan`, and advances absolute `floor`.

Rest floor:

- No enemies.
- Complete one rest choice.
- Open portal.

There is no automatic terminal state based on floor number.

## HUD

Replace the current `floor / 5` presentation with unlimited progression info.

Primary progression text:

- `Floor 17`
- `Chapter 4`

Chinese equivalent:

- `第 17 层`
- `第 4 章`

The current room role should be visible when useful, especially `Elite`, `Rest`, and `Boss`.

The main page HUD should keep only compact current-weapon information: rarity/name/base damage. Detailed affixes no longer need to consume the large horizontal HUD area because comparison moves into the game view.

## Role-following weapon comparison UI

The existing E-to-equip behavior remains the interaction contract:

- Potions auto-pick up.
- Weapons do not auto-equip.
- The nearest confirmable weapon inside pickup range becomes the current candidate.
- Press `E` to equip it.
- Leaving pickup range dismisses the candidate.

The comparison presentation changes from page-level horizontal UI to a vertical in-game card that follows the player.

### Layout

Candidate first, current weapon second:

```text
[Ground weapon]
EPIC Dungeon Blade
11 DMG   ↑ +3

★ Thunder 42%
+18% Attack Speed ↑
+8% Damage NEW

────────

[Current]
RARE Dungeon Blade
8 DMG

14% Attack Speed
4% Life Steal LOST

[E] Equip
```

Requirements:

- Narrow vertical card rather than wide desktop panel.
- Candidate rarity uses existing rarity colors.
- Build affixes appear first within an affix list and retain the star treatment.
- Comparable numeric affixes show `up/down/same` presentation.
- Candidate-only affixes show `NEW`.
- Current-only affixes show `LOST`.
- Base damage delta remains visible.
- Bilingual labels follow the current locale.

### Positioning

The card follows the player in game-space.

Preferred anchor is above and slightly to one side of the character so the character remains visible.

The renderer chooses left-above or right-above based on available screen/canvas space and clamps the card within the viewport.

The card must not follow the dropped weapon; it follows the player while displaying the currently selected nearest weapon.

Only one comparison card may be visible at a time.

### Rendering choice

Implement the card inside Phaser / the game canvas rather than as a page DOM overlay.

Reasons:

- It shares the same coordinate system as the player.
- Scaling/FIT behavior stays aligned with the canvas.
- No DOM-to-canvas coordinate translation is required.
- It can be clamped against the game viewport deterministically.

The Svelte page remains responsible for locale text callbacks and compact HUD data, but not for positioning the comparison card.

## Events and state boundaries

Pure progression logic should be separated from Phaser runtime code so it is testable without rendering.

Recommended modules/responsibilities:

- `progression.js`: chapter generation, room role lookup, chapter/floor advancement, difficulty scalar helpers.
- `rest.js`: rest choice generation/application and Fortune state rules.
- existing `combat.js`: adapt floor/boss/loot scaling to receive progression context rather than assuming floor <= 5.
- `scene.js`: orchestration of room role, waves, portal transitions, rest runtime, and progression state.
- existing `pickup-runtime.js`: preserve E-confirm behavior and expose candidate selection to presentation.
- new in-game comparison presentation/runtime module if keeping `scene.js` smaller is cleaner.
- `presentation.js`: pure comparison model/labels remain reusable.

Avoid putting chapter-generation randomness directly inside Phaser Scene methods where it becomes difficult to test.

## Compatibility / migration

Backward compatibility with a five-floor completion run is not required.

Remove or retire assumptions such as:

- floor is capped at 5.
- floor 5 always means run completion.
- `/5` HUD display.
- Boss exists only on absolute floor 5.

Existing room layouts can continue rotating by absolute floor modulo the authored layouts.

Existing music, player assets, monster assets, affixes, combat VFX, equipment comparison semantics, and E-confirm pickup behavior should be preserved.

## Testing strategy

Follow TDD.

Pure unit tests first for:

1. Chapter length always 4-8.
2. Last Chapter room is always Boss.
3. Rest count is 0-1.
4. Rest is never first.
5. Rest avoids direct Boss adjacency when a valid placement exists.
6. Progression increments absolute floor correctly across Chapter boundaries.
7. Boss completion advances into a new Chapter instead of completing the run.
8. Difficulty/wave helpers remain bounded at deep floors.
9. Rest Recover clamps HP.
10. Temper modifies eligible weapon data and recomputes derived state instead of stacking derived stats.
11. Temper fallback works without eligible affixes.
12. Fortune is consumed exactly once by the next combat-capable floor.
13. Pickup interaction still requires E for weapons and auto-picks potions.
14. Nearest weapon candidate behavior remains stable with multiple nearby drops.
15. Comparison model orders Build affixes first and preserves NEW/LOST/up/down semantics.
16. Positioning helper selects left/right anchor and clamps the vertical card inside the viewport.

Then integrate into Scene and Svelte/build verification.

## Non-goals for this slice

Do not add yet:

- Inventory/backpack.
- Currency or shop economy.
- Weapon reroll/forging/crafting.
- Meta-progression between runs.
- Leaderboards.
- Save/resume of an in-progress run.
- New rarity tiers above Epic.
- Multiple rest rooms per Chapter.
- Branching map/path selection.

These can be layered on later once the infinite Chapter loop is stable.

## Success criteria

A player can continue past the old fifth floor indefinitely.

Each Chapter is visibly 4-8 floors long, ends with a Boss, and may include a Rest floor.

Boss victory opens progression into the next Chapter rather than ending the run.

Death is the only run-ending state.

Difficulty and loot quality continue scaling without unbounded enemy density.

Rest floors provide one meaningful choice and then open the portal.

Weapon drops still require E to equip, but the comparison UI is now a narrow vertical card that follows the player and remains inside the game viewport.
