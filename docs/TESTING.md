# Testing

Three commands. Run them from the repository root.

| Command | Takes | What it proves |
| --- | --- | --- |
| `npm run test` | 1 second | The pure logic and all the level data are valid |
| `npm run check` | 10 seconds | Typecheck, unit tests and the production build all pass. This is what CI runs. |
| `npm run smoke` | 1 to 2 minutes | The real game boots in a browser and every room can be played from start to finish |

Run `npm run check` before every push. Run `npm run smoke` before every merge to `main` and before the final submission.

If `npm` is not found, Node is not on your PATH. In PowerShell: `$env:Path = "C:\Program Files\nodejs;$env:Path"`. In Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`.

## Unit tests: `npm run test`

Vitest, in `tests/`. They only import modules that do not import Phaser, so they need no browser.

| File | Covers |
| --- | --- |
| `tests/combat.test.ts` | Damage multipliers: weak 2x, resist 0.25x, neutral 1x, for every monster against every radiation |
| `tests/roomLayout.test.ts` | `validateLayout` reports each kind of layout mistake; `parseRoom` gives the right world coordinates, solids, walls and player start |
| `tests/content.test.ts` | Every room of every level and of the sandbox: valid layout, waves that spawn defined monsters in whole positive numbers, a player start that is not walled in. Radiation keys are unique and 1 to 4. Monster stats are positive. |

The content tests read `LEVELS`, `SANDBOX`, `MONSTERS` and `RADIATIONS` directly, so a new level, room, monster or radiation is covered the moment it is added. Nothing needs registering.

A failure names what to fix, for example:

```
level 2 "Noir" room 3: layout problems
  row 4, col 19: the outer ring must be wall
```

Rows and columns count from 0, from the top left of the layout.

`npm run typecheck` also type-checks the tests (`tests/tsconfig.json`).

## Smoke test: `npm run smoke`

`tools/smoke.mjs` starts its own dev server (port 5190) and its own headless Edge or Chrome (debugging port 9344), plays the game with real keyboard and mouse input, and shuts both down when it ends. It needs no extra packages.

What it does:

1. Opens `/` and waits for the game loop to run.
2. For every level, plays the rooms back to back. In each room it checks the room started and the HUD shows the right room number, holds W, A, S and D and checks the player moved each way, selects a radiation and holds the left mouse button until energy is spent, then presses K until every wave is gone and checks the game moves on to the next room (or ends the level after the last room).
3. Opens the busiest room of level 1, stands still until the monsters kill the player, and checks the room restarts with full health.
4. Opens `?sandbox`, plays its rooms the same way, then fires each radiation in turn.

It fails, with a non-zero exit code, on any console error, any uncaught exception, any step that times out, and a game that never starts.

Options:

| Option | Effect |
| --- | --- |
| `npm run smoke -- --strict` | Skipped checks and console warnings also fail the run. Use this for the final check before submission. |
| `npm run smoke -- --headed` | Shows the browser window so you can watch it play |
| `BROWSER` | Path to a Chromium browser, if Edge or Chrome is not in a usual place |
| `SMOKE_VITE_PORT`, `SMOKE_DEBUG_PORT` | Use other ports than 5190 and 9344 |

### Reading a failure

The log is one block per step. A failing step says what it was waiting for and what the game looked like at that moment:

```
[3] Level 1 "Golden Age" room 2/3 (reached by playing)
      room 2/3 of "Golden Age" started
      HUD shows 2/3
      Holding D for 300ms moved the player 0.0 units (expected at least 3); it went from ...
      screenshot of the failure: tools/out/09-FAIL-level-1-golden-age-room-2-3-reached-by-playing.png
  FAIL (2.4s)
```

- **Open the screenshot first.** Every step saves screenshots to `tools/out/` (not committed), and a failing step saves one at the moment it failed.
- **`console: ...` lines** are errors the game itself logged during that step, with a stack trace. These are almost always the real cause; fix them before looking at anything else.
- **`Timed out ... Last seen: scenes [...], room 2/3 ..., health ..., energy ..., frame N`** means the game did not reach the expected state. `frame 0`, or a frame number that never changes, means the game loop stopped: look for an exception above it.
- **`SKIP`** means a check could not be made because the game does not expose what it needs. The reason is printed. A SKIP does not fail a normal run, but it does fail `--strict`.
- **`Port 5190 ... is already in use`** means an earlier run is still alive or another program has the port. Stop it, or set `SMOKE_VITE_PORT`.
- After a failed room, the next room is opened directly with `?level=N&room=M`, so one broken room does not hide the rooms after it.
- To see it for yourself, run `npm run dev` and open the URL the step printed, for example `http://localhost:5173/?level=1&room=2`.

The smoke test reads the game through things that are meant to stay stable: scene keys (`Boot`, `Game`, `UI`), the events in `src/events.ts`, the level data in `src/config/`, and `window.__game`, which `src/main.ts` sets in dev. If you rename a scene, rename an event, change an event's arguments, or remove `window.__game`, tell QA.

## Dev shortcuts

These work only in the dev server (`npm run dev`), never in the built game.

| Shortcut | Effect |
| --- | --- |
| `?level=N&room=M` | Start in room M of level N (both count from 1) |
| `?sandbox` | Start in the sandbox level, which has every radiation. `?sandbox&room=M` starts in a later sandbox room. |
| `?gallery` | Show every texture on one sheet, for checking art |
| `?nodamage` | Nothing hurts the player. Combine with the others, for example `?level=2&room=2&nodamage`. |
| K key | Kill every monster in the current wave. It also opens a waiting chest and skips a wait for a caption, card or unclaimed secret. |

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm run check` on every push and pull request, on Node 24. It does not deploy and uses no secrets. The smoke test is not run in CI; run it locally.

## Before submitting

From `docs/rules.md`. Tick every line at the code freeze.

Build and stability:

- [ ] `npm run check` passes on a clean checkout (`npm ci` first).
- [ ] `npm run smoke -- --strict` passes.
- [ ] A person has played the built game (`npm run build`, then `npm run preview`) from the cover to the ending without a stuck state or a console error.
- [ ] That playthrough took 10 to 15 minutes for someone who had not played before. Playtime past 20 minutes is not judged.
- [ ] The dev shortcuts (K, `?level`, `?sandbox`, `?gallery`) do nothing in the built game.

itch.io:

- [ ] The contents of `dist/` are uploaded as an HTML5 game and the page is public.
- [ ] The game loads and plays from the itch.io page itself, in a private browser window, in Chrome and in Firefox.
- [ ] Sound starts after the first key press or click.
- [ ] The itch.io page lists every third-party asset with source links and licenses, the same as `CREDITS.md`.
- [ ] The itch.io page discloses the AI tools used.

Repository:

- [ ] The GitHub repository is public.
- [ ] `LICENSE` is in the repository root.
- [ ] `CREDITS.md` is in the repository root and lists every third-party asset (art, audio, fonts, libraries) with its source link and license. No paid assets are used.
- [ ] `CREDITS.md` has the AI disclosure: every LLM and every image, sound or 3D generator that was used.
- [ ] Everything is committed and pushed before the deadline. No commits after the freeze, and no backdating.
- [ ] All three themes are in the game: Comic, Twist, Light.
