# Agent Workflow Rules

These rules apply to automated coding work in this repository.

## Branch and commit policy

- Work directly on the branch requested by the user.
- `main` is the only branch that requires commit squashing/cleanup by default. Before finishing work on `main`, squash the task's iterative commits into a clean commit unless the user explicitly asks for a different history.
- On every non-`main` branch (for example `feat/*`, `fix/*`, `refactor/*`), commit changes normally to that branch. Do **not** squash, rewrite, force-update, or rebuild history unless the user explicitly asks for it.
- Do not move work to `main` merely to simplify tooling or history management.
- Prefer ordinary file edits and normal commits on feature branches. Avoid low-level Git object/tree manipulation solely to manufacture a squashed commit.
- If a task is already being developed on a feature branch, continue there unless the user explicitly requests a branch change.

## Adding or restructuring games

- Read `docs/ADDING_A_GAME.md` before adding a game.
- Keep game-specific behavior with the game where practical instead of adding another branch to shared code.
- Do not force a game to implement `game.Game` or another shared interface just for consistency.
- Add a shared abstraction only when at least two real consumers benefit from it and the abstraction makes both simpler.
- Recording and replay behavior belong to each game; shared replay code must not define a universal game recording format.
- Structural refactors must preserve existing gameplay, public WebSocket actions/payloads, routes, and page behavior unless the task explicitly asks to change them.

## Safety

- Never rewrite shared branch history implicitly.
- Before any force push, reset, rebase, squash, or history rewrite, require explicit user intent unless the operation is the normal `main` cleanup rule above.
