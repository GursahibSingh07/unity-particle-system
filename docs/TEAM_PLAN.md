# Light Handler: Team Plan

How the work in the [game plan](GAME_PLAN.md) is split across 5 people over 3 days.

Roles are lettered; the team decides who takes which. Role A fits whoever owns the repo and does the merging.

| Role | Taken by |
| --- | --- |
| A. Lead and core | |
| B. Weapons | |
| C. Monsters and AI | |
| D. Visual style | |
| E. Design, UI, audio, QA | |

## Roles

| Role | Owns | Files |
| --- | --- | --- |
| **A. Lead and core** | Game loop, scene flow, player, panel progression, merging, builds | `types.ts`, `events.ts`, `main.ts`, `scenes/Game.ts`, `entities/Player.ts`, `systems/WaveDirector.ts` |
| **B. Weapons** | The EMW Machine: 4 radiations, energy, damage table, hit feedback | `systems/EMWMachine.ts`, `systems/Combat.ts`, `config/radiation.ts` |
| **C. Monsters and AI** | Monster base, 4 behaviours, boss, spawn telegraphs | `entities/Monster.ts`, `entities/behaviours/`, `config/monsters.ts` |
| **D. Visual style** | Per-level filters and rule changes, shape look for every entity, particles, screen shake, transitions | `systems/StyleManager.ts`, `config/styles.ts` |
| **E. Design, UI, audio, QA** | Wave data for all levels, balance, HUD and menus, sound, story text, playtest timing, submission page | `config/levels/`, `scenes/UI.ts`, menu and ending scenes, `systems/AudioManager.ts` |

All paths are under `src/`.

## Day by day

### Day 1: core loop

Goal by end of day: one panel where you can move, aim, fire 2 radiations at 2 monsters, take damage, die and restart.

| Role | Tasks |
| --- | --- |
| **A** | Contracts session with everyone (first 2 hours). Extract `Player` from `scenes/Game.ts`. Panel walls, health, death and restart. WaveDirector reading level data. |
| **B** | Radio and Infrared firing, energy bar logic, damage table. |
| **C** | Monster base class, Swarmlet and Frostling, contact damage. |
| **D** | Shape and colour language for player and monsters. Golden Age and Noir filters. |
| **E** | Level 1 wave data, HUD (health, energy, selected radiation), main menu. |

### Day 2: all content

Goal by end of day: all 5 levels playable start to finish, unbalanced, with a first timed playthrough.

| Role | Tasks |
| --- | --- |
| **A** | Camera slide between panels, level-to-level flow, checkpoints, pause. Integrate everyone's work at each sync point. |
| **B** | Ultraviolet and Gamma. Hooks so styles can change fire rate, heat and aim snapping. |
| **C** | Shade and Ironclad (with bullets), spawn telegraphs, The Prism boss. |
| **D** | Manga and 8-bit filters plus their rule changes (with B). Particles, screen shake, panel transition. |
| **E** | Wave data for levels 2-5, level intro text, sound effects and music wired in, first timed playthrough. |

### Day 3: polish and ship

Feature freeze at midday. Submit 3 hours before the deadline.

| Role | Tasks |
| --- | --- |
| **A** | Bug fixing, final build, upload, test the uploaded build. |
| **B** | Weapon feel: recoil, hit flashes, balance numbers with E. |
| **C** | Boss tuning, AI bugs, difficulty curve with E. |
| **D** | Final-page style swapping, ending reveal (filters off), visual polish. |
| **E** | Balance to hit 15-20 minutes, game over and ending screens, twist text, submission page and screenshots. |

## Hand-offs that block other people

| From → To | When | What |
| --- | --- | --- |
| A → everyone | Day 1, first 2 hours | `types.ts` and `events.ts`. Nothing else starts until these are merged. |
| B ↔ C | Day 1 | Monsters expose `takeDamage(type, amount)`; weapons call it. Agree the signature in the contracts session. |
| A → E | Day 1 afternoon | The level data format, so E can write waves while the code is still being built. |
| B → D | Day 2 morning | The modifier hooks, so D's style rules have something to change. |
| C → E | Day 2 afternoon | All 4 monsters spawnable, so levels 2-5 can be authored and timed. |

## Working rules

- One branch per person; merge to `main` at three sync points a day (midday, evening, end of day).
- Run `npm run build` before every merge. `main` must always run.
- Only edit files you own. Need a change elsewhere? Ask the owner.
- Every tunable number lives in `src/config/`, so E can balance without touching logic.
- Ten-minute stand-up at each sync point: what is done, what is blocked.
