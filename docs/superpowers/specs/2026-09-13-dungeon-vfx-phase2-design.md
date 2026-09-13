# Dungeon VFX Phase 2 Design

## Goal

Turn Dungeon's existing VFX assets into a coherent visual language without changing combat math, loot probabilities, progression rules, or encounter behavior.

## Scope

This phase expands the current seven-kind VFX vocabulary into explicit semantic categories, supports multiple assets per category, assigns blend mode per category, wires missing gameplay events to VFX, and only then integrates the Retro Impact pack for impact-oriented effects.

Out of scope: new combat mechanics, new affixes, damage tuning, drop-rate tuning, map-generation changes, new audio systems, shader/post-processing work, or increasing effect density just to showcase assets.

## Taxonomy

The runtime taxonomy becomes:

- `slash` — weapon swing trails
- `impact` — ordinary hit confirmation
- `critical` — critical-hit accent
- `beam` — piercing / ray effects
- `lightning` — chain and thunder arcs
- `whirlwind` — radial spin attack
- `explosion` — corpse burst / heavy death burst
- `flame` — campfire / fire accents
- `sparkle` — loot, chest and reward accents
- `heal` — potion and recovery effects
- `portal` — exit / transition effects
- `aura` — elite/boss/equip/floor-complete emphasis
- `smoke` — corpse burst / impact aftermath

Classifier aliases may map filename concepts such as `hit`, `burst`, `heal`, `portal`, `shield`, `glow`, `smoke`, `dust`, and `aura` into those semantic kinds, but runtime callers only depend on the taxonomy above.

## Catalog and Selection

`vfxCatalog(manifest)` must retain ordered arrays of assets per kind instead of selecting one asset globally. Runtime selection is event-stable: each playback chooses a variant using a deterministic key derived from effect kind and event coordinates/counter, not a per-frame random source. The same playback never switches assets mid-animation.

Callers may request a preferred source or strength, but gameplay code must not know archive names. Source preference remains encapsulated in `vfx-runtime.js`.

## Blend Modes

Blend mode is semantic rather than globally additive:

- ADD: `beam`, `lightning`, `flame`, `sparkle`, `heal`, `portal`, `aura`
- NORMAL: `slash`, `impact`, `critical`, `whirlwind`, `explosion`, `smoke`

Fallback rendering must remain valid when a category has no matching asset.

## Event Wiring

Existing combat math stays untouched. VFX hooks cover:

- ordinary hit -> `impact`
- critical hit -> `critical` layered lightly over `impact`
- piercing -> `beam`
- chain -> lighter `lightning`
- thunder -> stronger `lightning`
- whirlwind -> `whirlwind`
- normal kill -> `impact` plus existing small debris only
- corpse burst -> `explosion` plus `smoke`
- potion/heal -> `heal`
- equipment drop -> `sparkle`, rarity-scaled
- equipment pickup/equip -> `sparkle` + brief `aura`
- chest reward -> `sparkle`
- portal spawn -> `portal` with optional low-intensity `sparkle`
- rest camp -> `flame`
- floor clear -> `aura`
- elite/boss presentation -> `aura`

The existing `visuals.js` remains limited to non-asset UI/procedural feedback such as floating text and camera/critical support. It must not regain color-coded semantic interception.

## Retro Impact Pack

`Retro Impact Effect Pack ALL.rar` is integrated only after taxonomy, catalog variants, and blend modes are working. Its assets are admitted only into impact-oriented categories (`impact`, `critical`, `explosion`, `smoke`) based on filenames and alpha validity. It must not become a generic source for unrelated categories.

If the archive structure cannot be extracted reliably by the existing Node asset-preparation pipeline, add a narrow extraction adapter rather than pushing archive-specific logic into gameplay/runtime files.

## Performance

No continuous high-frequency spawning is added except the already-bounded rest-camp flame loop. Aura effects must be bounded or attached to existing elite/boss lifecycle and cleaned up on room/floor shutdown. Variant selection must be O(number of candidates for one kind), with manifest preprocessing doing the classification work.

## Verification

Tests must cover:

- all 13 taxonomy classifications and rejected unrelated assets
- catalog retaining multiple variants per kind
- deterministic/stable variant choice
- semantic blend-mode mapping
- impact vs critical separation
- event hooks for heal, equip/pickup, portal, floor clear, elite/boss aura and corpse-burst smoke
- missing-asset fallback behavior
- no change to combat/loot numeric functions

Run Dungeon/VFX-focused frontend tests plus the repository's frontend test command if available. Build verification is required before merging to main when the environment can execute it.
