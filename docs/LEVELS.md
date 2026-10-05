> Note (Director, 5 October 2026): the three timed eras were shortened from 135 to 120 seconds after this was written, to stay inside the 10-15 minute rule. The spawn tables' `from` times were tuned for 135 and were not rescaled, so late arrivals get less time on screen. A death in Golden restarts the wave the player fell in, not the era.

# Light Handler: Eras (v2)

The playable content, era by era. The data lives in `src/config/levels/` (one file per era; `index.ts` exports `LEVELS` in play order) and every word the player reads lives in `src/config/text.ts`. The design is the team's `docs/ideas.md`; the contract is `docs/DESIGN.md`.

Every era is the same city square, `SQUARE_LAYOUT` in `src/config/square.ts`. An era only adds its secret: `squareWithCrack(col, row)` in `src/config/levels/crack.ts` turns one wall tile into `S`.

```
####################      # building wall      e street entry
####################      . , paving           P player start
#........ee........#      o lamp post          F fountain
#..o............o..#
#e.....,....,.....e#      Four streets: north (two tiles), west and east
#e.......FF.......e#      (two tiles each), south (one tile, beside the start).
#......,.FF.,......#
#..o............o..#
#........eP........#
####################
```

## How to read the numbers

- **Measured (bot).** A scripted player in headless Edge driving the real game with real keys and mouse. It aims perfectly at the nearest enemy, picks the ray for its class, backs away when crowded and dashes when touched. It does not dodge thrown things, step off ice or acid, or look for hearts. So it kills faster than a person and is hurt more than a careful one. Each figure is from one to three runs: treat them as a sanity check, not a statistic.
- **Simulated.** The spawn tables run 400 times through the real `pickEntry` and `spawnInterval` (`src/systems/eraClock.ts`), ignoring `maxAlive`. These are exact for the data but say nothing about the player.
- **Estimate.** A judgement about a first-time player. Nobody has played these eras by hand yet.

Numbers the estimates lean on (`src/config/rays.ts`, `src/config/monsters.ts`): the player has 100 health and walks at 70. Energy is 100 and comes back at 26 a second.

| Kill | Cost |
| --- | --- |
| Rat (10) or bat (8) with Blue | One flash (12) kills every one in the cone |
| Slime (26) with Blue | Three flashes, 0.9 s |
| Ironclad (130) | Blue: 11 flashes, 3.3 s and 88 energy. Red (1.5x): about 2 s at its usual distance, 1 s point blank |
| Golem (260) | Red (1.5x) point blank: 2.1 s. Blue: 22 flashes and two energy bars |
| Rat pack or zig-zag bats (14) with Green | One blob (26, or 52 against speed) kills everything in the burst |
| Skitter (36) with Green | One blob (52) |
| Ghost (60), wraith (44) | UV halves it and holds it still; then any ray. In overdrive one or two Blue flashes finish it |
| Snowman (55), acid slime (70) with White | Four rings (18 each), 2.4 s if he stays within 46 units of it |

## Pacing

| Part | Measured (bot) | First play (estimate) | Budget (DESIGN.md) |
| --- | --- | --- | --- |
| Cover and intro | - | 0.5 min | 0.5 |
| 1. Golden Age | 38 to 46 s from load to cleared (two clean runs); 75 s with one death | 2.2 min: about 90 s of fighting, 35 s of captions, three item cards, wave gaps and the page turn | 2.5 |
| 2. Neon Dusk | 138 s clean (120 s clock, 3 s before it starts); 168 s with the one death the bot had, in the surge | 2.5 min clean, 2.9 with one death | 2 |
| 3. Late Edition | Before the last easing of the table: 4 deaths, not finished in 260 s. Not measured since | 2.5 min clean, 3.1 with one or two deaths | 2 |
| 4. White Page | 144 s with one death at 0:49 | 2.5 min clean, 2.9 with one death | 2 |
| 5. The Final Page | Not measured: the bot cannot fight the Prism through its era switches | 2 min, 2.5 with a retry | 2 |
| Ending | - | 1 min | 1 |
| **Total** | | **13.2 min with no deaths, about 15 with the deaths above** | **12.5** |

The timed eras cannot be shorter than their clock: 120 s, plus about 15 s of title card, captions and item cards (the clock stands still under those), plus the walk-in. A death costs the time back to the last 45-second checkpoint: 22 s on average, 45 at worst. **So the total sits at the top of the 10 to 15 minute window.** If playtests run long, the cheapest fix is `duration: 120` in the three timed eras (checkpoints stay at 0:45 and 1:30, the surge is still the last 20 s): it saves 45 s and changes nothing else.

## 1. Golden Age (`goldenAge`)

Given: Blue, Red, Green. Rule: the full wheel, no dash. Four waves; each begins when the last is dead.

Intro: "Noon in the city square. The sun on every window!" / "And monsters, in broad daylight. Only one man sees them." / "Turn the wheel, Light Handler. Find the colour that bites!"

| Wave | Spawns | Teaches | Bot | First play (estimate) |
| --- | --- | --- | --- | --- |
| 1 | 10 rats (a cluster of six and one of four) | Moving, and that one Blue flash clears a pack | 5 s | 15 s |
| 2 | 5 slimes, 8 bats | Bats fly straight over the fountain while slimes go round; a slime takes three flashes | 7 s | 20 s |
| 3 | 2 Ironclads, 3 slimes | Armour: keeps its distance and throws after a wind-up. Blue makes small words, Red makes big ones | 13 to 16 s | 25 s |
| 4 | 1 Golem, 1 Ironclad, 12 rats, 6 bats | Rays stop at the Golem, so the pack behind it is safe until he steps round it. Red up close for the Golem, Blue for the rest | 13 s | 30 s |

- **Intensity:** low, low, medium, high. The bot, which does not dodge, ended its clean runs on 28 and on 4 health and died once in wave 4: wave 4 is a real test, and a death restarts the era from wave 1. If first players die here often, drop the Ironclad from wave 4.
- **Secret:** Blue. The crack is at column 4, row 1: the shop front left of the town hall, on the north wall's lower row. Blue is what he fires most here, so this is the one most likely to be found by accident, which teaches that cracks exist.

## 2. Neon Dusk (`cyberpunk`)

Given: the dash. Rule (`ERA_RULES.cyberpunk`): Blue is gone; Red and Green; one dash, 3 s cooldown. 120 s; checkpoints at 0:45 and 1:30; surge from 1:40.

Intro: "Dusk. Neon. The Blue ray is gone from the wheel." / "Red and Green remain. The monsters are quicker."

`spawnEvery: [3800, 2000]`, `maxAlive: 16`, `surge: 20` (the wait between arrivals is halved in the surge).

| From | Monster | Group | Weight | Why |
| --- | --- | --- | --- | --- |
| 0:00 | zigbat | 2 | 5 | The speed class, alone for twelve seconds |
| 0:12 | rat | 4 | 3 | The packs Blue used to clear: one Green blob does it now |
| 0:25 | slime | 2 | 2 | A full-charge blob kills it exactly |
| 0:50 | skitter | 1 | 4 | Just after the first checkpoint: it bolts when hit, so he must aim again |
| 1:10 | ironclad | 1 | 1 | Rare: the one thing here Red is for |
| 1:35 | zigbat | 4 | 3 | Just after the second checkpoint: bigger flocks |
| 1:45 | skitter | 2 | 2 | Pairs |

Earlier swarm and armour fall in proportion because every later line dilutes them: rats are 3 of 8 at 0:12 and 3 of 20 by 1:45.

Simulated arrivals (enemies per 15 s): 9, 14, 10, 12, 11, 12, 12, 19, 36. Health arriving per second: 8, 11, 10, 12, 13, 17, 15, 25, 48. About 133 enemies in all: 60 zig-zag bats, 45 rats, 14 skitters, 13 slimes, 2 Ironclads.

- **Intensity:** a calm first 45 s (zig-zag bats, then rats), a slow build through the skitter, a step up after 1:30, and a surge at about four times the opening rate. Each checkpoint is followed by a new line of the table rather than a rest (see Requests).
- **Measured:** the bot never had more than 9 alive, so the cap of 16 only matters in the surge. Its health went 100, 89, 39, 17 across the three thirds and it died once, six seconds into the surge.
- **Secret:** Green. Column 0, row 7: the bookshop's wall, low on the west side.

## 3. Late Edition (`retro`)

Given: double dash, UV lens. Rule (`ERA_RULES.retro`): overdrive (twice as fast, twice as hard, twice the drain); the wheel is locked and turns by itself every 5 s; F switches to UV; two dashes, 5 s cooldown. 120 s; checkpoints at 0:45 and 1:30; surge from 1:40.

Intro: "Dark now. The machine runs hot. Too hot." / "The wheel turns by itself. Something hides."

`spawnEvery: [3400, 1500]`, `maxAlive: 34`, `surge: 20`.

| From | Monster | Group | Weight | Why |
| --- | --- | --- | --- | --- |
| 0:00 | rat | 6 | 5 | Fodder: the crowd. An overdriven flash clears a pack whatever the wheel shows |
| 0:00 | bat | 5 | 3 | Fodder that ignores the fountain |
| 0:10 | ghost | 1 | 2 | Stealth: nothing but UV touches it, and UV is the only thing he still chooses |
| 0:25 | slime | 3 | 2 | Something that survives one flash |
| 0:50 | wraith | 1 | 2 | Just after the first checkpoint: faster, dashes twice, does not wait to hide again |
| 1:00 | zigbat | 3 | 2 | Speed, for when the wheel happens to show Green |
| 1:20 | ironclad | 1 | 1 | Rare: one thing that wants a colour the wheel may not give |
| 1:35 | rat | 8 | 3 | Just after the second checkpoint: the horde |

Simulated arrivals (enemies per 15 s): 26, 23, 22, 21, 23, 26, 29, 47, 82. Health arriving per second: 18, 19, 19, 19, 22, 26, 28, 45, 78. About 300 enemies in all: 180 rats, 67 bats, 21 slimes, 16 zig-zag bats, 8 ghosts, 6 wraiths, 2 Ironclads. A ghost arrives about once every 17 s; the chance that none comes in the first 45 s is about one in eight.

- **Intensity:** dense from the start but soft (everything in the first 25 s dies to one flash, bar the ghost), flat to 1:15, then the horde and a surge that will sit on the cap of 34.
- **Measured:** with an earlier, harder table (`[3400, 1300]`, cap 40, ghost weight 3, hordes of 10) the bot died four times and did not finish in 260 s; its health fell fastest when stealth enemies were about, because it only looks at the nearest enemy. The table was eased to the numbers above and **has not been run since**. This is the era most likely to need another pass.
- **Secret:** UV. Column 15, row 1: the shop front right of the town hall, on the north wall's lower row. "It shows what hides."

## 4. White Page (`manga`)

Given: Unprism (White). Rule (`ERA_RULES.manga`): White only; two dashes, 5 s cooldown. 120 s; checkpoints at 0:45 and 1:30; surge from 1:40.

Intro: "No colour left." / "Only white light."

`spawnEvery: [4600, 2600]`, `maxAlive: 14`, `surge: 20`.

| From | Monster | Group | Weight | Why |
| --- | --- | --- | --- | --- |
| 0:00 | snowman | 1 | 4 | Alone at first: the ring sends the snowball back at it |
| 0:05 | rat | 5 | 4 | Fodder: one ring kills a pack that gets close |
| 0:22 | acidSlime | 1 | 2 | A marker, then a pool: not something to push back, something to step off |
| 0:35 | bat | 4 | 3 | Fodder over the furniture |
| 0:50 | slime | 2 | 2 | Just after the first checkpoint: takes two rings |
| 1:20 | snowman | 2 | 2 | Pairs: ice from two sides |
| 1:40 | acidSlime | 2 | 1 | Just after the second checkpoint: ice and acid together |

There is no armour, speed or stealth enemy here at all: White does a quarter damage to them, so each would be a wall he cannot remove (an Ironclad would take 44 rings). Swarm is the fodder; throwers are the era.

Simulated arrivals (enemies per 15 s): 10, 8, 11, 11, 11, 11, 13, 19, 29. About 125 enemies in all: 63 rats, 27 bats, 19 snowmen, 8 slimes, 8 acid slimes. A thrower arrives about every 5 s on average and takes about that long to walk to and kill, so they build up slowly; the cap of 14 is what bounds the air (fourteen throwers would be about six things thrown a second; the bot saw 8 to 14 alive, mostly fodder).

- **Intensity:** one snowman to start, steady through the middle, pairs from 1:20, and a surge that fills the cap.
- **Measured:** the bot (which stands in ice and acid) died once at 0:49 and finished the rest from 0:45 without dying, ending the surge on 29 health.
- **Secret:** White. Column 19, row 7: the pharmacy's wall, low on the east side. The ring reaches it from anywhere within three tiles.

## 5. The Final Page (`finalPage`)

No grants, no secret. The plain square, one wave: one `prism` (1400 health). Rule: `ERA_RULES.finalPage` (everything, two dashes) until its first switch; then whatever era it has switched to.

Intro: "It comes wailing up the street. Red, then blue." / "It changes the page. The machine changes with it." / "Watch the sign above its head."

It dashes twice, then stands still for 3 s with the coming era over its head (free damage), then redraws the square: Golden, Cyberpunk (faster, brings speed enemies), Retro (fades out; UV first), Manga (shards for White to send back). The length is set by its health and by `PRISM` in `src/config/monsters.ts`, not by anything in the era file. Estimate 2 minutes; not measured.

## Secrets at a glance

| Era | Ray | Tile (col, row) | Wall |
| --- | --- | --- | --- |
| Golden Age | blue | 4, 1 | North, lower row: shop left of the town hall |
| Neon Dusk | green | 0, 7 | West: the bookshop |
| Late Edition | uv | 15, 1 | North, lower row: shop right of the town hall |
| White Page | white | 19, 7 | East: the pharmacy |

Two are on the north wall's lower row, where the crack reads best (a real wall face); two are on side walls for variety. None touches a street entry. Each drops a health upgrade (+2 blocks) onto the paving in front of it.
