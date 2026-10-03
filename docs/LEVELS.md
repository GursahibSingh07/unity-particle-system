# Light Handler: Levels

The playable content, room by room. The data lives in `src/config/levels/` and every word the player reads lives in `src/config/text.ts`. The layout legend is in `docs/DESIGN.md` section 7.

## How to read the timings

Each room has two numbers.

- **Bot (measured).** A scripted player in headless Edge, driving the real game with real key and mouse input. It always picks the right radiation, aims perfectly at monsters it should not be able to see, and walks straight at each spawn. It does not dodge projectiles, use cover or path around walls. So it is faster than a person in open rooms and takes more damage than a person in walled rooms. Times are from the room loading to the last monster dying, with the level intro skipped, over three runs of the final wave lists unless noted.
- **First play (estimate).** The bot time scaled for a person who waits for monsters to arrive, misses, and is working out the new tool: about 2x in level 1, about 1.6x in levels 2 and 3, about 1.5x for the boss. These factors are a judgement, not a measurement. Nobody has played these rooms by hand yet.

Fixed costs used in the estimates: a level's title card and three intro captions (about 8 s), walking to the chest and reading the item card (about 10 s), each room change (about 3 s), and for every wave a 1.0 s delay plus a 0.6 s spawn telegraph before anything can be hit.

Numbers the estimates lean on (from `src/config/monsters.ts` and `src/config/radiation.ts`):

| Kill | Cost |
| --- | --- |
| Swarmlet with Radio | One pulse (12 damage against 10 health) kills everything within 44 units |
| Frostling with Radio | 7 pulses and 140 energy, so the bar runs dry once: 8 to 10 s |
| Frostling with Infrared | 0.5 s of beam (80 per second against 40 health) |
| Shade with Ultraviolet | 3 flashes, 1.6 s from first to last, inside the 2.2 s stun |
| Ironclad with Gamma | 2 charged shots (64 each against 120 health), 0.75 s charge each, 90 energy |
| The Prism | 1390 health over four phases; about 20 s a phase for the bot |

## Pacing

| Part | Bot, combat only (measured) | First play (estimate) | Budget |
| --- | --- | --- | --- |
| Cover and intro | - | 0.5 min | 0.5 min |
| Level 1, Golden Age | 18 + 18 + 28 = 64 s | 128 s combat + 22 s fixed = 2.5 min | 2.5 min |
| Level 2, Noir | 21 + 29 + 45 = 95 s | 152 s combat + 28 s fixed = 3.0 min | 3 min |
| Level 3, Manga | 28 + 27 + 38 = 93 s | 149 s combat + 28 s fixed = 3.0 min | 3 min |
| Boss, The Final Page | 81 s | 122 s combat + 10 s fixed + one retry = 2.7 min | 2.5 min |
| Ending | - | 1.0 min | 1 min |
| **Total** | **333 s** | **12.7 min** | **12.5 min** |

If the scaling factors are wrong by a quarter either way, the total lands between about 10.5 and 15 minutes.

## Level 1: Golden Age

The player has Radio. Infrared comes from the chest in room 1. New monsters: Swarmlet, then Frostling.

Intro: "The city sleeps. The Light Handler does not!" / "Monsters roam the square in broad daylight." / "Only one man can see them. So one man must act."

### 1.1 The Square

```
####################
#..................#
#.o......C.......o.#
#..................#
#.....,......,.....#
#..................#
#.....,......,.....#
#.o......P.......o.#
#..................#
####################
```

- **Teaches:** moving and the Radio pulse, in an open room with nothing to get caught on. Flocks arrive small, then larger, then from two sides (ten Swarmlets spawn as a cluster of six and a cluster of four).
- **Waves:** 4 Swarmlets / 6 Swarmlets / 10 Swarmlets / 1 Frostling.
- **Why the Frostling:** it is alone, slow (30 against the player's 70) and cannot catch anyone, but Radio only chips it: the hit words drop from the big electric ones to plain "pow", and seven pulses empty the energy bar once. The player meets the energy bar and the idea of a wrong tool in complete safety, then the chest hands over the right one.
- **Chest:** top centre, Infrared.
- **Time:** bot 17 to 19 s (measured). First play about 40 s.

### 1.2 The Counter

```
####################
#..................#
#..,............,..#
#..................#
#....oooooooooo....#
#..................#
#..................#
#.........P........#
#..................#
####################
```

- **Teaches:** the Infrared beam, and that crates stop feet but not radiation. A Frostling on the far side has to walk the long way round while the player burns it over the top.
- **Waves:** 1 Frostling / 3 Frostlings / 2 Frostlings + 6 Swarmlets / 4 Frostlings + 6 Swarmlets. The Swarmlets are there to make the player switch back to Radio.
- **Time:** bot 17 to 19 s (measured). First play about 37 s.

### 1.3 The Doorway

```
####################
#HS....#...........#
##,....#.....o.....#
#......#...........#
#..P...............#
#..................#
#......#...........#
#......#.....o.....#
#......#...........#
####################
```

- **Teaches:** walls stop the beam, so position matters. Most spawns land in the big right-hand room and funnel through the two-tile door, where one beam burns the whole queue.
- **Waves:** 3 Frostlings / 8 Swarmlets + 2 Frostlings / 3 Frostlings + 6 Swarmlets / 4 Frostlings + 10 Swarmlets.
- **Secret (Infrared):** the cracked wall at column 2, row 1, in the top-left corner behind the player's back. It seals a one-tile alcove with the health upgrade at column 1, row 1. The heart is visible from the start; a patch of rough floor sits under the crack. It is close to the start on purpose (see the note under Secrets).
- **Time:** bot 26 to 32 s (measured). First play about 55 s.

## Level 2: Noir

The player has Radio and Infrared. Ultraviolet comes from the chest in room 1. New monster: Shade.

Intro: "Night falls. The colour drains out of the streets." / "Something moves here that the eye cannot follow." / "The Handler needs a light that tells the truth."

### 2.1 Four Corners

```
####################
#..................#
#...###...C..###...#
#...###......###...#
#..................#
#........P.........#
#...###......###...#
#...###......###...#
#..................#
####################
```

- **Teaches:** sight lines. Four blocks cut the beam, so the player has to find a clear street, and flocks come round corners. Only the two tools already owned are needed.
- **Waves:** 8 Swarmlets + 2 Frostlings / 4 Frostlings / 12 Swarmlets + 3 Frostlings.
- **Chest:** between the two top blocks, Ultraviolet.
- **Time:** bot 20 to 23 s (measured). First play about 35 s.

### 2.2 Lamplight

```
####################
#..................#
#.....o......o.....#
#..................#
#........,,........#
#.........P........#
#..................#
#.....o......o.....#
#..................#
####################
```

- **Teaches:** the Shade, alone, in a room with no walls to block the flash or hide a dash. Then one with a small flock, then two, then two with a flock.
- **Waves:** 1 Shade / 1 Shade + 4 Swarmlets / 2 Shades / 2 Shades + 6 Swarmlets.
- **Time:** bot 28 to 29 s (measured). First play about 47 s.

### 2.3 Round the Block

```
####################
#..................#
#..o............o..#
#.......####.......#
#.......#H##.......#
#.......#S##.......#
#........,.........#
#..o......P.....o..#
#..................#
####################
```

- **Teaches:** a loop. A Shade needs a clear line to dash, so the building's corners are safety, and trouble comes both ways round. Frostlings resist Ultraviolet, so the player has to keep switching.
- **Waves:** 1 Shade + 2 Frostlings / 2 Shades + 6 Swarmlets / 2 Shades + 1 Frostling / 2 Shades + 2 Frostlings + 4 Swarmlets.
- **Secret (Ultraviolet):** the cracked wall on the building's south face at column 9, row 5, two tiles from the start. The health upgrade sits inside the building at column 9, row 4, in plain view.
- **Time:** bot 37 to 50 s on the runs it cleared (measured); it cleared 3 of 7 runs, mostly dying pressed against the building with a Frostling on it, which is the bot's lack of pathing more than the room. First play about 72 s. This is the hardest room before the boss.

## Level 3: Manga

The player has Radio, Infrared and Ultraviolet. Gamma comes from the chest in room 1. New monster: Ironclad.

Intro: "Faster now! Speed lines tear across the page!" / "They come in armour that shrugs off every ray." / "There must be a light that nothing can stop."

### 3.1 Two Doors

```
####################
#..................#
#........C.........#
#..................#
#####..######..#####
#..................#
#...o..........o...#
#.........P........#
#..................#
####################
```

- **Teaches:** nothing new; it is the exam on three tools. The wall splits the room, so the far half is out of beam and flash until the player commits to a door.
- **Waves:** 6 Swarmlets + 1 Shade / 2 Frostlings + 2 Shades / 8 Swarmlets + 2 Frostlings + 1 Shade.
- **Chest:** in the far half, Gamma.
- **Time:** bot 25 to 31 s (measured, cleared 2 of 3). First play about 45 s.

### 3.2 The Trenches

```
####################
#................#H#
#.................S#
#...###......###..,#
#..................#
#.........P........#
#...###......###...#
#..................#
#..................#
####################
```

- **Teaches:** the Ironclad, alone. Low walls stop what it throws, and Gamma goes straight through them, so the lesson is to shoot from cover.
- **Waves:** 1 Ironclad / 1 Ironclad + 6 Swarmlets / 2 Ironclads.
- **Secret (Gamma):** the cracked wall at column 18, row 2, sealing the health upgrade in the top-right corner at column 18, row 1. Gamma reaches it from anywhere in the room, including through the trench walls.
- **Time:** bot 27 to 28 s (measured; it took about 70 damage each run because it never dodges). First play about 43 s.

### 3.3 Full Spread

```
####################
#..................#
#.....#......o.....#
#....##............#
#..................#
#.........P........#
#............##....#
#.....o......#.....#
#..................#
####################
```

- **Teaches:** everything at once. Two L-shaped walls and two crates on a diagonal give cover from two Ironclads without making corridors.
- **Waves:** 6 Swarmlets + 2 Frostlings + 1 Shade / 1 Ironclad + 1 Shade + 2 Frostlings / 2 Ironclads + 6 Swarmlets.
- **Time:** bot 37 to 40 s (measured, cleared 2 of 3, again on projectile damage). First play about 61 s.

## Boss: The Final Page

Intro: "It arrives howling. It flashes red, then blue." / "Every colour at once. Every monster in one." / "This is the last page, Light Handler. Turn it."

```
####################
#..................#
#...o..........o...#
#..................#
#........,,........#
#........,,........#
#..................#
#...o.....P....o...#
#..................#
####################
```

- **Layout:** The Prism cannot use tiles next to a solid, so the room is open. The four crates sit one tile nearer the top and bottom walls than in the sandbox, which leaves it the whole middle (columns 6 to 13) plus the two side lanes on rows 4 and 5. Crates stop its volleys and do not block any radiation.
- **Wave:** 1 Prism.
- **Time:** bot about 81 s on each of its two clears, about 20 s a phase (measured). It died in 5 of 7 attempts, nearly always in the Infrared phase at around 30 s, from repeated contact; it also died 4 times out of 4 in the sandbox boss room, so it is the fight and the bot rather than this layout. First play about 2.7 min with one retry.

## Secrets

| Level | Room | Radiation | Cracked wall (col, row) | Upgrade (col, row) |
| --- | --- | --- | --- | --- |
| 1 | 3, The Doorway | Infrared | 2, 1 | 1, 1 |
| 2 | 3, Round the Block | Ultraviolet | 9, 5 | 9, 4 |
| 3 | 2, The Trenches | Gamma | 18, 2 | 18, 1 |

Each one uses the radiation that level's chest gave, so the rule a player can learn is "this page's new light opens this page's wall". All three were checked in the running game: the wrong radiation does nothing, the right one breaks the wall, and walking in raises maximum health from 100 to 110.

A room without a chest ends the moment its last monster dies, so these have to be taken during the fight. That is why the first two are within two or three tiles of the player start, where they can be seen and broken in the quiet second and a half before the first wave appears, and why the third uses Gamma, which reaches from anywhere.
