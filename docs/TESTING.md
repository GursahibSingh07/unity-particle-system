# Testing

Run everything from the repository root.

| Command | Takes | What it proves |
| --- | --- | --- |
| `npm run test` | 1 second | The pure logic and all the era data match the design (`docs/DESIGN.md`) |
| `npm run check` | 15 seconds | Typecheck (game and tests), unit tests and the production build all pass. This is what CI runs. |
| `npm run smoke` | 5 minutes | The real game, in a browser, with real keys and mouse: the cover, all five eras under their weapon rules, the boss, the ending, deaths, the sandbox, a secret, the settings |
| `npm run smoke:build` | 30 seconds | The production build renders, starts on a key press, and has no dev helpers in it |
| `npm run smoke:long` | 7 minutes | `npm run smoke`, then one whole timed era played in real time with no shortcuts: the clock, the crowd cap and the frame times |

Run `npm run check` before every push. Run `npm run smoke` and `npm run smoke:build` before every merge to `main`. Run all of them before the freeze.

If `npm` is not found, Node is not on your PATH. In PowerShell: `$env:Path = "C:\Program Files\nodejs;$env:Path"`. In Git Bash: `export PATH="/c/Program Files/nodejs:$PATH"`.

## Unit tests: `npm run test`

Vitest, in `tests/`, in Node. They only import modules that do not import Phaser, so they need no browser.

| File | Covers |
| --- | --- |
| `tests/combat.test.ts` | `RAY_VS_CLASS` is the table of DESIGN section 5 (Blue 1x; Red 1.5x armour; Green 2x speed; White 1.5x swarm and projectile, 0.25x the rest; UV nothing but stealth). `damageMultiplier` returns it for every ray against every class and every defined enemy. `redFalloff` is 1 at the muzzle, never rises, and leaves Red above Blue up close and below Blue at full range. |
| `tests/roomLayout.test.ts` | Every problem `validateLayout` and `validateRoom` can report, one test each, including the secret rules (an `S` needs a ray, a ray needs an `S`, one `S` at most, on the outer ring, with open paving in front) and the timed-room rules. `parseRoom`: coordinates, solids, walls, street entries, secrets, the start. `floorInFront`. |
| `tests/eraClock.test.ts` | The arithmetic of a timed era: the spawn interval ramps from `spawnEvery[0]` to `spawnEvery[1]` and never rises; checkpoints; the surge window; `pickEntry` respects `from` and weights (with a fixed random seed). |
| `tests/content.test.ts` | The data against the design. `LEVELS` is the five eras in order, each one room on `SQUARE_LAYOUT` with at most one `S`. Golden runs on a two-minute clock, brings in the rat, then the slime and bat, then the Ironclad, then the Golem (section 2), and nothing but swarm and armour; every timed era has a sane clock, cap and spawn table; the boss era is one Prism. Grants match section 2, and no era fires a ray or uses a dash that has not been handed over. Each secret's ray can be fired under that era's rule. `ERA_RULES` match section 5, `MONSTERS` section 6. Every room of every era and of the sandbox validates. `GUIDE`, `UPGRADES`, `RAYS`, `HEART.dropChance` cover every id; captions fit their box (60 characters); the report ends with the charge. |
| `tests/timing.test.ts` | The jam's 10 to 15 minutes. Adds the clocks of the timed eras (from the data) to the allowances of DESIGN section 2 for the cover, the boss and the ending. A guard, not a measurement: it stops one edited number pushing the game outside the rule. |
| `tests/audio.test.ts` | `validateTracks()` finds no problem in the score, and every track compiles to notes. No audio is played. |
| `tests/settings.test.ts` | `src/settings.ts` against a stand-in for `localStorage`: the defaults (demo mode off), merging with what was saved, surviving blocked or missing storage, `watchSettings`. |

The tests read `LEVELS`, `SANDBOX`, `MONSTERS`, `RAYS` and `ERA_RULES` directly, so an era, a sandbox room, a spawn-table line or an enemy is covered the moment it is added. The lists of ids in `tests/helpers.ts` are tied to the types in `src/types.ts`: add a `MonsterId` or a `RayId` and `npm run typecheck` fails until the list has it.

Where a test restates the design (the tables at the top of `tests/content.test.ts`, the allowances in `tests/timing.test.ts`), change the design and the test together.

A failure names what to fix, for example:

```
era 3 "Late Edition" table line 5 (wraith): from 130s is not before the end of the era (120s), so it never appears
era 2 "Neon Dusk": the secret needs blue, which this era's rule cannot fire
sandbox room 13: room problems
  row 7, col 0: an S tile needs open paving in front of it
```

Rows and columns count from 0, from the top left of the layout.

`npm run typecheck` also type-checks the tests (`tests/tsconfig.json`).

## Smoke test: `npm run smoke`

`tools/smoke.mjs` starts its own dev server (port 5190) and its own headless Edge or Chrome (debugging port 9344), plays the game with real keyboard and mouse input, and shuts both down when it ends, whatever happens. It needs no extra packages. Run one at a time: it is a whole browser.

What it does:

1. **Cover.** Opens `/`: only the cover is running, and it is really drawn (the screenshot is read back).
2. **New game.** A key press starts era 1 with nothing owned. The title card, the captions and the item card are put away with Space, each answered by the UI and not by a timeout, without a dash slipping out. The HUD shows 1/5.
3. **Each era**, opened with `?level=N&nodamage`. The cards, the HUD (`N/5`), W A S D, then the weapon under that era's rule, read from `ERA_RULES` so it follows the data:
    - the wheel: E and Q turn it through its colours and every colour fires (`SHOT` for a flash, `BEAM` on and off for the laser, a charge then `SHOT` for the blob), spending energy;
    - a locked wheel (Retro): it turns by itself within its period, and Q and E are refused;
    - an empty wheel (Manga): Q and E do nothing, White fires;
    - the mode key: F goes through every mode the rule has, UV and White fire, and with one mode F does nothing;
    - the dash: each charge is a `DASHED` and moves him, an empty dash is refused, a charge comes back; in Golden, Space does nothing.
4. **Timed eras** (Golden, Cyberpunk, Retro, Manga). The clock runs in real time for three seconds, stands still for a second and a half under the pause page (Esc) and runs again. Then K winds it to zero: at least one `CHECKPOINT`, exactly one `SURGE`, the timer at 0, and the next era starts.
5. **Boss.** The Prism is announced away from the player. `BOSS_TELEGRAPH` is followed by `ERA_SWAPPED` to the same era after the time it stated; the square and the machine's rule follow. K fells it.
6. **Ending.** The Ending scene is drawn. K takes the torch away and skips the first captions; the officer's lines, the report (down to the charge), the corrected Field Guide and the credits are read with Space. The cover comes back alone, and a second new game starts clean: era 1, nothing owned, the item card shown again.
7. **Death**, without `nodamage`, in a timed era (sandbox room 12): the retry picks its clock up from the last checkpoint, with full health. (Every shipped era is timed, so the old check that a death restarts the wave is kept in the script, `goldenDeathStep`, but not run.)
8. **Sandbox.** Every room loads, something arrives, and K clears it through to the next.
9. **Secret** (sandbox room 13). He walks to the crack; the wrong rays leave it, the right ray breaks it (`secretBroken`), the upgrade is picked up and maximum health rises.
10. **Settings.** From the cover: S opens the sheet, a volume and demo mode are changed and found in `localStorage`. The cover offers every era, still does after a reload, ignores other keys, and key 3 starts era 3 with the earlier upgrades owned. The settings are put back through the sheet and the saved copy is removed.

It fails, with a non-zero exit code, on any console error, any uncaught exception, any step that times out, and a game that never starts.

Options:

| Option | Effect |
| --- | --- |
| `npm run smoke -- --long` (`npm run smoke:long`) | After the normal plan, plays the whole of Cyberpunk in real time with `nodamage` and a simple bot that walks laps, fires, turns the wheel and dashes. Fails unless the timer reaches 0 in about its own length of real time, alive plus incoming never passes `maxAlive` (counted every frame), and the checkpoints and the surge come once each. Prints minimum, average and worst frame time. `--long=retro` or `--long=manga` plays that era instead. |
| `npm run smoke -- --preview` (`npm run smoke:build`) | The production check alone: see below |
| `npm run smoke -- --only=eras,death` | Only those parts: `boot`, `eras`, `death`, `sandbox`, `settings`, `long` |
| `npm run smoke -- --strict` | Skipped checks and console warnings also fail the run. Use this for the final check before submission. |
| `npm run smoke -- --headed` | Shows the browser window so you can watch it play |
| `BROWSER` | Path to a Chromium browser, if Edge or Chrome is not in a usual place |
| `SMOKE_VITE_PORT`, `SMOKE_DEBUG_PORT` | Use other ports than 5190 and 9344 |

Frame times from the long run are from a headless browser drawing in software. They show a spike or a slow climb as the crowd grows; they are not the frame rate a player gets.

### The production build: `npm run smoke:build`

Builds the game into a temporary folder (the repository's `dist/` is not touched), serves those files with a small static server of its own on port 5190, and opens them in the browser. This is the nearest thing to the itch.io page that can be run here.

1. The cover is drawn, there is one canvas, and nothing is logged to the console.
2. `window.__game` is undefined.
3. `?level=3`, `?sandbox&room=5`, `?gallery2` all show the cover.
4. A key press starts era 1. K does not skip the title card and does not kill a wave. `?nodamage` does not make the player invincible.

The build has no `window.__game`, so here the test finds the Phaser game as it is constructed. Nothing in the game is changed for it.

### Reading a failure

The log is one block per step. A failing step says what it was waiting for and what the game looked like at that moment:

```
[4] Era 2 "Neon Dusk" (?level=2&nodamage): movement, weapon rule, dash, clock, pause, K to the end
      title card, 2 captions and the item card (dash) put away with Space (5 presses)
      HUD shows 2/5
      WASD moves the player (units: D 21, A 20, W 20, S 21)
      fired red: BEAM on and off, energy 100 -> 81
      Timed out after 5s waiting for dash 1 of 1 (no "dashed" event). Last seen: scenes [Game, UI], room 1/1 of "Neon Dusk",
        era { started true, waiting false, cleared false, finished false, wave 1, alive 2, incoming 0, clock 9.4s, 111s left }, ...
      screenshot of the failure: tools/out/14-FAIL-era-2-neon-dusk-level-2-nodamage-movement-weapon-rule.png
  FAIL (14.2s)
```

- **Open the screenshot first.** Every step saves screenshots to `tools/out/` (not committed), and a failing step saves one at the moment it failed.
- **`console: ...` lines** are errors the game itself logged during that step, with a stack trace. These are almost always the real cause; fix them before looking at anything else.
- **The lines above the failure** are the checks that passed, in order. The one that failed is the next thing in the list under "What it does".
- **`Timed out ... Last seen: ...`** means the game did not reach the expected state. `era { ... }` is `snapshot()` of the Game scene: `waiting true` means a card or caption is still up; `started false` means the era never began. A frame number that never changes means the game loop stopped: look for an exception above it.
- **An event name in quotes** (`"dashed"`, `"era-swapped"`) is from `src/events.ts`. The test waited for the game to emit it, or saw it carry something other than the contract says.
- **`SKIP`** means a check could not be made, and says why. A SKIP does not fail a normal run, but it does fail `--strict`.
- **`Port 5190 ... is already in use`** means an earlier run is still alive or another program has the port. Stop it, or set `SMOKE_VITE_PORT`.
- **`The browser closed the connection`** means the browser died, usually because the machine ran out of memory. Close other programs and run it again; it is not a fault in the game.
- To see it for yourself, run `npm run dev` and open the URL in the step's name, for example `http://localhost:5173/?level=2&nodamage`, or run the one part again with the window showing: `npm run smoke -- --only=eras --headed`.

The smoke test reads the game through things that are meant to stay stable: the scene keys (`Boot`, `Title`, `Game`, `Ending`, `UI`), the events and their arguments in `src/events.ts`, `snapshot()` on the Game scene, the data in `src/config/`, the HUD's `n/5` text, the settings key `light-handler.settings`, and `window.__game`, which `src/main.ts` sets in dev. It reads one private thing, the Game scene's `player`, for his position. If you rename or change any of these, tell QA.

## Dev helpers

These work only in the dev server (`npm run dev`), never in the built game. `npm run smoke:build` checks that.

| Helper | Effect |
| --- | --- |
| `?level=N` | Start era N (1 to 5) with everything the earlier eras hand over |
| `?sandbox`, `?sandbox&room=M` | The test level: every ray, every mode, both dashes. Rooms 1 to 11 are the enemies class by class and the Prism; 12 is a 30-second timed room with a checkpoint every 10; 13 has a secret that only Red breaks. |
| `?nodamage` | Nothing hurts the player. Combine with the others, for example `?level=3&nodamage`. |
| `?gallery2` | The old and the v2 art sheets |
| K | Kills everything alive and ends a wait for a caption or card. In a timed era it also winds the clock on by one checkpoint interval. In the ending it takes the torch away, then skips each caption and card. |
| `window.__game` | The Phaser game. `__game.scene.getScene('Game').snapshot()` says where the era stands. |

Demo mode is not a dev helper: it is in the settings of the built game too, off by default, and offers every era on the cover.

## CI

`.github/workflows/ci.yml` runs `npm ci` and `npm run check` on every push and pull request, on Node 24. It does not deploy and uses no secrets. The smoke tests need a browser and are not run in CI; run them locally.

## Uploading to itch.io

**Build, zip the contents of `dist/`, and upload the zip to itch.io as an HTML game.** The project is already set up for this: `vite.config.ts` uses relative paths (`base: './'`), so the build works from itch.io's subfolder.

1. **Build it.** In a new terminal in the repo:
   ```
   npm run check
   npm run build
   ```
   The game lands in `dist/`. If `npm` isn't found, open a fresh terminal so Node is on PATH.

2. **Zip the contents of `dist/`, not the folder itself.** `index.html` must be at the top level of the zip. In PowerShell:
   ```
   Compress-Archive -Path dist\* -DestinationPath light-handler.zip -Force
   ```

3. **Create the project on itch.io.** Dashboard → Create new project, then:
   - **Kind of project:** HTML.
   - **Uploads:** upload `light-handler.zip` and tick "This file will be played in the browser".
   - **Embed options:** set the viewport to 1280 × 720 and enable the fullscreen button. The game scales to fit, so a smaller frame also works.
   - **Visibility:** Public (the jam rules require a public build). You can keep it Draft while you test, then switch.

4. **Fill in the page for the rules.**
   - **Credits:** list the three fonts with source links and licences, same as `CREDITS.md`.
   - **AI disclosure:** state the AI tools used, same as `CREDITS.md`.

5. **Test from the itch.io page itself**, in a private window:
   - The game loads and starts on a key press.
   - Keys work after clicking into the frame.
   - Space dashes without scrolling the page.
   - Sound starts after the first input.
   - Settings survive a reload.

None of step 5 can be checked by the automated tests: it can only be tested on the real page.

Before uploading, commit and push everything, and don't commit after the freeze. The full pre-submission checklist follows. If the jam has its own submission page on itch.io, you also need to submit the project to the jam from there.

The text for the itch.io page itself (description, themes, credits, AI disclosure) is in `submission.txt` in the repository root.

## Before submitting

From `docs/rules.md`. Tick every line at the code freeze.

Build and stability:

- [ ] `npm run check` passes on a clean checkout (`npm ci` first).
- [ ] `npm run smoke -- --strict` passes.
- [ ] `npm run smoke:build` passes: the built game renders, starts, and has no dev helpers (K, `?level`, `?sandbox`, `?nodamage`, `window.__game`).
- [ ] `npm run smoke:long` passes, and its frame times show no spike in the surge.
- [ ] Demo mode is off by default, and a first visit to the page starts a normal game on any key.
- [ ] A person has played the built game (`npm run build`, then `npm run preview`) from the cover to the credits without a stuck state or a console error.

The jam's rules for the game itself:

- [ ] All three themes are in the game: **Comic** (the comic eras, captions, hit words), **Twist** (the ending: the torch, the arrest report, the corrected Field Guide), **Light** (the EMW Machine and its rays).
- [ ] A timed playthrough by a person who has not played before takes 10 to 15 minutes, cover to credits. Write the time down. Playtime past 20 minutes is not judged. (`tests/timing.test.ts` only guards the arithmetic; it does not replace this.)
- [ ] The loop is complete and stable: cover, five eras, ending, credits, back to the cover, and a second game starts clean.

itch.io:

- [ ] The contents of `dist/` are uploaded as an HTML5 game and the page is public.
- [ ] The game loads and plays from the itch.io page itself, in a private browser window, in Chrome and in Firefox. The page embeds the game in a frame: check that the keys work after one click on the game, that Space does not scroll the page, and that the settings survive a reload.
- [ ] Sound starts after the first key press or click.
- [ ] The itch.io page lists every third-party asset with source links and licenses, the same as `CREDITS.md`.
- [ ] The itch.io page discloses the AI tools used.

Repository:

- [ ] The GitHub repository is public.
- [ ] `LICENSE` is in the repository root.
- [ ] `CREDITS.md` is in the repository root and lists every third-party asset (fonts, libraries, any art or audio not made by the game's own code) with its source link and license. No paid assets are used.
- [ ] `CREDITS.md` has the AI disclosure: every LLM and every image, sound or 3D generator that was used, and what for. The credits card in the game points to it.
- [ ] The code is fresh: no game template or starter kit, and the commit history shows it being built.
- [ ] Everything is committed and pushed before the deadline. No commits after the freeze, and no backdating on GitHub or itch.io.
