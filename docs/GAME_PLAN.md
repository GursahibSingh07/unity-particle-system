# Light Handler: Game Plan

TGC GameJam 2026. Built with Phaser 4, Vite and TypeScript.

**Constraints:** 3 days to submission, 15-20 minutes of gameplay, art from shapes and shaders only.

See also: [Team plan](TEAM_PLAN.md) for who does what.

## How we reach 15-20 minutes in 3 days

Content is **data, not code**. A level is a "comic page" made of 3-4 **rooms** (arenas). Each room is a list of monster waves in a config file. Clear a room and the camera slides to the next one. Dying restarts the current room only, so playtime stays predictable.

| Level | Comic style | New radiation | New monster | Rooms | Target time |
| --- | --- | --- | --- | --- | --- |
| 1 | Golden Age (bright, flat colours) | Radio, Infrared | Swarmlet, Frostling | 3 | 3 min |
| 2 | Noir (black and white, dark) | Ultraviolet | Shade | 3 | 3.5 min |
| 3 | Manga (high contrast, speed lines) | Gamma | Ironclad | 3 | 3.5 min |
| 4 | 8-bit (pixelated) | none, mixed waves | none | 4 | 4 min |
| 5 | Final page (styles swap per boss phase) | none | Boss: The Prism | 1 | 3 min |

Plus about 1.5 minutes of intro, between-level and ending text: **about 18.5 minutes total**.

## Core design

**Controls:** WASD move, mouse aim, left click fire, keys 1-4 switch radiation, Esc pause.

### Radiation types

One shared energy bar that regenerates.

| Key | Type | How it fires | Best against |
| --- | --- | --- | --- |
| 1 | Radio | Ring pulse around the player, knockback, low damage | Swarmlets |
| 2 | Infrared | Continuous short beam, burn over time | Frostlings |
| 3 | Ultraviolet | Wide cone flash, reveals and stuns | Shades |
| 4 | Gamma | Charged thin ray, pierces walls and armour, costs a lot of energy | Ironclads |

### Monsters

All drawn as shapes.

| Monster | Shape | Behaviour | Weak to |
| --- | --- | --- | --- |
| Swarmlet | Small green circles, groups of 8-12 | Flocks toward the player | Radio |
| Frostling | Cyan triangle | Chases directly | Infrared |
| Shade | Dark purple diamond, nearly invisible | Dashes; untouchable until revealed | Ultraviolet |
| Ironclad | Grey square, armoured | Slow, shoots bullets | Gamma |
| The Prism (boss) | Large hexagon | 4 colour phases, each with one weakness; spawns minions | Cycles |

Damage is one lookup table: weak = 2x, neutral = 1x, resistant = 0.25x.

### Comic style changes the machine

This is the proposal's main hook: each level's look also changes a rule.

| Style | Look (Phaser 4 built-in camera filters) | Rule change |
| --- | --- | --- |
| Golden Age | Quantize + saturated ColorMatrix | None (tutorial) |
| Noir | Greyscale ColorMatrix + Vignette | Colour cues are gone and vision is limited; firing lights the scene |
| Manga | Greyscale + Threshold, speed-line particles | Overdrive: double fire rate, but the machine overheats |
| 8-bit | Pixelate + Quantize | Aim snaps to 8 directions |
| Final page | Style swaps with each boss phase | Rule swaps with it |

All of these filters ship in Phaser 4.2.1 (`camera.filters.internal.addQuantize`, `addColorMatrix`, `addVignette`, `addThreshold`, `addPixelate`), so no custom shader code is required.

### Twist

The Light Handler has schizophrenia. There were never any monsters or an EMW Machine: he has been shining a torch at random people in public, and he is arrested for causing mild annoyance.

How the ending plays out:

1. The boss goes down and every comic filter drops. The world is shown in plain, flat colours for the first time.
2. The "monsters" are redrawn as ordinary passers-by (plain grey circles), squinting and shielding their eyes. The EMW Machine is a pocket torch with one dim yellow beam; keys 1-4 no longer do anything.
3. The Prism's flashing colour phases turn out to be a police car's lights. An officer walks up and the player's controls are taken away.
4. Final card, deadpan: an arrest report card, "Charge: causing mild annoyance to the public."

Earlier levels can foreshadow this cheaply: monsters never attack first in the level 1 tutorial room, Ironclad "bullets" are people throwing things back, and level intro text is written in the Handler's confident voice so the report card contrasts with it.

It costs almost nothing to build because everything is shapes: swap colours, remove filters, show two text cards.

### Audio

Sound effects made with [jsfxr](https://sfxr.me/), plus 1-2 CC0 music loops. Check each licence and note the source in the README.

## Code structure

Each folder has one owner so five people rarely touch the same file.

```
src/
  types.ts            shared interfaces (the contract everyone codes against)
  events.ts           event name constants
  config/             radiation.ts, monsters.ts, styles.ts, levels/level1..5.ts
  entities/           Player.ts, Monster.ts, behaviours/
  systems/            EMWMachine.ts, Combat.ts, WaveDirector.ts, StyleManager.ts, AudioManager.ts
  scenes/             Boot, MainMenu, Game, UI (HUD overlay), LevelIntro, Pause, GameOver, Ending
```

The existing player code in `src/scenes/Game.ts` moves into `entities/Player.ts`, and `src/main.ts` gains the new scenes.

## Milestones

| When | Milestone | Done means |
| --- | --- | --- |
| Day 1, first 2 hours | Contracts | `types.ts`, `events.ts` and the level data format agreed and merged |
| Day 1 end | Core loop | One room: move, aim, fire 2 radiations at 2 monsters, take damage, die, restart |
| Day 2 midday | All systems | 4 radiations, 4 monsters, style filters, HUD, room progression |
| Day 2 end | Full run | All 5 levels playable start to finish, unbalanced; first timed playthrough |
| Day 3 midday | **Feature freeze** | Boss, ending, audio, menus in; only fixes and balance after this |
| Day 3, 3 hours before deadline | Submit | Build uploaded and tested from the upload page; the remaining time is buffer |

## If we fall behind, cut in this order

1. 8-bit aim snapping (keep the filter only)
2. Level 4 (drops to about 14.5 min, so lengthen waves in levels 1-3)
3. Boss phases (boss becomes one large mixed wave)
4. Pickups and the heat meter

## Stretch goals

Only after feature freeze is safe: halftone dot shader, health pickups, score and timer, a fifth radiation (X-ray).

## How we check it

- Each milestone is checked by running `npm run dev` and playing it.
- `npm run build` must pass before every merge.
- The 15-20 minute target is checked by timed full playthroughs at Day 2 end and Day 3 midday, by someone who did not author the levels.
