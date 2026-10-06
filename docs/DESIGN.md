# Light Handler: Design

The game as it is now. How it got here, version by version, is in [CHANGELOG.md](CHANGELOG.md). The jam's rules are in [rules.md](rules.md).

Every number below is a tunable in `src/config/`; if this file and the config disagree, the config is what the game does.

## 1. The game in one paragraph

A top-down action game in a 16-bit console look. The Light Handler defends a city square with the EMW Machine, turning its colour wheel to match the ray to the enemy. The square is the same place in every era, but each era it is drawn with less: fewer details, fewer colours. The Handler has schizophrenia and it is getting worse, and the player sees the world drain as he does. In the ending the detail returns, in plain daylight: there were never any monsters, he has been shining a pocket torch at passers-by, and he is arrested for causing mild annoyance to the public.

The three jam themes: **Light** is the weapon and the whole combat system; **Comic** is the cover, the eras drawn as comic styles, the hit words and the pause book; **Twist** is the ending, which changes the meaning of everything before it.

## 2. Structure

One level per era, all on the same square (`src/config/square.ts`). A full run is about 12 to 14 minutes.

| # | Era | Look | Given at the start | Rule of the machine | Length |
| --- | --- | --- | --- | --- | --- |
| 1 | Golden Era | Bright sunshine, every detail | Blue, Red, Green | Full wheel, no dash | 2:00 |
| 2 | Cyberpunk Era | Dusk and neon, fewer details | Dash | No Blue; one dash, 3 s cooldown | 2:00 |
| 3 | Retro Era | Dark and dull | Double dash, UV lens | Overdrive; wheel locked, turning itself every 5 s; UV mode; two dashes, 5 s | 2:00 |
| 4 | Manga Era | Black and white outlines | White (Unprism) | White only; two dashes | 2:00 |
| 5 | Boss Era | Swaps with the boss | - | Whatever era the boss has switched to | about 2 min |
| - | Ending | Full detail, natural daylight | - | A pocket torch | about 1 min |

**Timed eras.** Eras 1 to 4 run on a clock. Enemies come in from the four street entries until it runs out, with a surge in the last 20 seconds; then whatever is left is swept away and the next era begins. There is a checkpoint every 45 seconds: dying restarts from the last one with full health, so the length of a run does not depend much on skill.

**What arrives** (from `src/config/levels/`; the number is the first second it can appear):

| Era | Arrivals | Most alive at once |
| --- | --- | --- |
| Golden | rats 0, slimes 18, bats 30, Ironclad 40, Golem 65 | 20 |
| Cyberpunk | zig-zag bats 0, rats 12, slimes 25, skitter 50, Ironclad 55, Golem 75 | 16 |
| Retro | rats and bats 0, ghost 10, slimes 25, wraith 50, zig-zag bats 60, Ironclad 60, Golem 80 | 34 |
| Manga | snowman 0, rats 5, acid slime 22, bats 35, slimes 50 | 24 |

## 3. Design pillars

1. **Teach by play, not text.** Each new enemy appears after the player has met the ones before it.
2. **Hide what helps to hide.** Strengths and weaknesses are never stated in normal play. The player learns them from the comic hit words: big for a strong ray, tiny and grey for a weak one.
3. **The rule of each era is the lesson of each era.** Losing Blue, the locked wheel, White only: the same square, played a different way each time.
4. **Hidden mercy.** The player's hurtbox is smaller than the sprite. After two deaths at the same checkpoint a heart waits near the start. Never announced.
5. **Telegraph everything.** Every attack has a visible wind-up. Every arrival is announced.
6. **The world drains.** Same square, less of it each era. The ending gives it all back.
7. **The twist re-reads everything.** Field Guide notes are true of the real thing too.

## 4. Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left mouse button | Fire (hold for Red; hold and release for Green) |
| Q / E | Turn the colour wheel |
| F | Switch mode: RGB, UV, Unprism |
| Space | Dash; also advances captions and cards |
| Esc or P | Pause: the comic book |

## 5. The EMW Machine

One shared energy pool of 100, which refills after a short pause in firing. The colour wheel is at the bottom right of the screen.

| Ray | Mode | What it does | Damage | Strong against |
| --- | --- | --- | --- | --- |
| Blue | RGB | A cone in front that hits everything in it. Stopped by walls | 16 a shot | Swarm (1.5x) |
| Red | RGB | A laser while fire is held. Passes through enemies | 84 a second up close, falling to 21 at full range | Armour (1.5x) |
| Green | RGB | A lobbed blob. A tap goes a short way; a full charge goes far. The burst slows, and leaves a pool that slows for 7 s | 11 uncharged, 16 fully charged | Speed (2x) |
| White | Unprism | A ring all round the player. Pushes enemies back and turns thrown things round | 16 | Swarm and projectile (1.5x); 0.25x against the rest |
| UV | UV | A cone that reveals stealth enemies and halves their health, and stuns everything in it for 0.2 s | none | Stealth |

- **Overdrive** (Retro): fires twice as fast, hits twice as hard, drains energy twice as fast.
- **Locked wheel** (Retro): Q and E do nothing; the wheel turns by itself every 5 seconds, with a warning a second before.
- **Dash:** a short burst in the movement direction (the aim direction when standing still). Nothing can hurt the player during it and he passes through enemies, but not walls.
- **Ray-blockers:** Blue, Red and Green stop at a Golem's body.

The damage table is `RAY_VS_CLASS` in `src/config/rays.ts`, read through `damageMultiplier` in `src/systems/Combat.ts`. Each era's rule is in `ERA_RULES` in the same file.

## 6. Enemies

| Enemy | Class | Health | Behaviour | Really is |
| --- | --- | --- | --- | --- |
| Rat | swarm | 10 | Runs at the player in packs | Pigeons |
| Slime | swarm | 26 | Hops at the player in short bursts | Small dogs on leads |
| Bat | swarm | 8 | Flies straight over the fountain and lamp posts | Starlings |
| Ironclad | armour | 110 | Keeps its distance and throws after a wind-up | A cyclist in a helmet |
| Golem | armour | 221 | Winds up, then rolls in a straight line; rays stop at it | A delivery man with a loaded trolley |
| Zig-zag bat | speed | 14 | Fast, flies in a zig-zag | A kid on a scooter |
| Skitter | speed | 36 | Darts in to bite; bolts away when hit | A jogger |
| Ghost | stealth | 60 | Nearly invisible and untouchable until UV reveals it; dashes after a wind-up | A man in a dark coat |
| Wraith | stealth | 44 | A meaner ghost: faster, dashes twice | The cinema's doorman |
| Snowman | projectile | 55 | Throws snowballs that leave ice; ice slows the player | An ice-cream vendor |
| Acid slime | projectile | 70 | Lobs acid onto a marked spot; the pool hurts over time | A window cleaner with a bucket |
| The Prism | boss | 1008 | See below | A police car |

**The Prism.** It dashes at the player three times, each after a wind-up, then switches the era: the coming era shows over its head and on the HUD for 2 seconds, then the whole square is redrawn in that era and the machine obeys that era's rule until the next switch (the dash is kept throughout). For 1 second after each switch nothing hurts it, and it blinks until it can be hurt again. It cycles Golden, Cyberpunk, Retro, Manga. Each era also colours its behaviour: faster in Cyberpunk, hidden between attacks in Retro (and untouchable until UV exposes it), shedding rings of shards in Manga that White can send back. Two enemies arrive with every switch, armour first, and never more than four are alive beside it. Its health bar is in the middle of the top strip.

**Field Guide.** A page unlocks on the first kill of each enemy. After the ending every page shows what it really was.

## 7. Secrets, hearts, upgrades

- **Secrets:** one in each of eras 1 to 4, a hairline crack in a building wall. Only that era's secret ray breaks it; a health upgrade (+2 blocks, kept for the run) drops out.

  | Era | Where | Ray |
  | --- | --- | --- |
  | Golden | North side, shop front left of the town hall | Blue |
  | Cyberpunk | West wall, the bookshop, near the bottom-left corner | Green |
  | Retro | North side, shop front right of the town hall | UV |
  | Manga | East wall, the pharmacy, near the bottom-right corner | White |

- **Hearts:** enemies drop one now and then, more often when the player is low. Each restores 25 health.
- **Upgrades** are handed over on one card as an era begins (`LevelDef.grants`).

## 8. Settings

`src/settings.ts`, saved in the browser. Reached from the cover (S) and from the pause book.

| Setting | Effect |
| --- | --- |
| Music, Sound | Volume in ten steps |
| Screen shake | On or off |
| Demo mode | Every era can be started from the cover (keys 1 to 5), and from the Eras page of the pause book mid-game. The Field Guide also names each enemy's weakness and the machine's page names what each ray is strong against |
| God mode | Nothing hurts the player. Can be switched mid-era |

## 9. Interface

- **Cover:** a comic cover with the controls in small print.
- **HUD:** health as 20 blocks in two rows of ten (gold-rimmed extras for upgrades) at the top left; the era and its clock, or the boss's health bar, at the top centre; the colour wheel with its energy ring, mode plate and dash pips at the bottom right.
- **Hit words:** comic sound words on every hit, sized by how well the ray suits the enemy.
- **Pause book:** an open comic book of four spreads turned with Q, E or Tab, with a page-turn animation: the eras as comic panels with the run's tallies; the Field Guide; the machine; settings with an exit to the cover.
- **Fonts:** Pixelify Sans for the game's own text; Bangers and Comic Neue in the pause book.
- **Weathering:** time and use are painted over the square in code after it is drawn (`src/art/v2/city/weather.ts`), over the whole picture at once so the parts grow together, as Rain World does its erosion. Damp climbing the fronts, streaks under the sills, soot, mottled plaster, posters and notices, ivy, down-pipes between the shops, curtains, blinds and pot plants in the windows, moss, lichen and aerials on the roofs; dirt gathered against the walls, grass in the joints, pitted and stained stone, polished paths from the streets to the fountain, drain grates, litter drifted into the corners, a chalk hopscotch. Each era wears differently: Cyberpunk has tags, neon posters, wet cables and silhouettes at the blinds; Retro's grime is dithered into its few colours; Manga's is ink hatching and stipple; the real square in the ending is the most lived-in of all. Nothing draws a crack in a wall (a crack marks each era's secret) and nothing is placed near a secret wall, and the open paving stays calm so enemies read against it.
- **Light:** baked into the square with a direction. In Golden and the ending the lamp posts lay long shadows to the south-east; in Golden the sun breaks through under the arch and pours in through the west street. Retro's lamps make dim pools of their own.
- **Motion:** the square is never still (`src/systems/cityLife.ts`, `LIFE` in `src/config/look.ts`): smoke drifts from every chimney, the fountain throws spray, steam rises from the drain grates in Cyberpunk and Retro, the lamps breathe in the dark eras, and the Cyberpunk shop signs glow and stutter (the tailor's is on its way out). All of it is decoration: none of it can be hit, and nothing flies like a bat.
- **Hand-made look:** a light layer over each era (`src/config/look.ts`, `src/systems/handmade.ts`): paper grain and fibres, uneven ink, faint film grain, a vignette and a colour grade, and a few motes in the air (dust in Golden, rain in Cyberpunk, ash in Retro, ink flecks in Manga, leaves in the ending). Golden and the cover add faint halftone dots; Cyberpunk adds a glow round the neon; Manga's lines boil gently. The ending has no print effects. The HUD is not filtered.

## 10. How it is built

Phaser 4, Vite, TypeScript. No image or audio files: the art is pixel art defined in code and drawn to textures at boot, and the music and sound are synthesised with the Web Audio API.

```
src/main.ts          Game config, scene list
src/scenes/          Boot, Title (cover), Game (one era), Ending, UI (everything the player reads)
src/entities/        Player, enemies, projectiles, hazards, pickups
src/systems/         The machine and its rays, spawning, the era clock, pathfinding, layout parsing
src/config/          Every tunable number: rays, enemies, flow, the square, the eras, the words
src/art/v2/          Sprites, palettes and the painted city square, baked at boot
src/audio/           Synth, tracks, sound effects
src/ui/              HUD, colour wheel, captions, cards, the pause book
tests/               Unit tests for the pure logic and all the data
tools/smoke.mjs      An automated playthrough in a real browser
```

- **Coordinates:** the world is 320x180 units shown at zoom 4 on a 1280x720 canvas; tiles are 16 units. Art is drawn at 2 texture pixels per unit, so world sprites go through `worldScale` and physics bodies through `fitCircleBody` (`src/systems/artScale.ts`). All text lives in the UI scene, which is not zoomed.
- **The square** is one layout of 20 by 10 tiles: `#` building, `.` and `,` paving, `o` furniture, `F` fountain, `e` street entry, `P` player start, `S` cracked wall. Flyers ignore furniture and the fountain.
- **Textures** are baked by `bakeArtV2` (`src/art/v2/index.ts`) as `{name}-{style}` for each of the five styles (goldenAge, cyberpunk, retro, manga, plain); the sheets and their frame orders are listed in `src/art/v2/sheets.ts`. In `plain` every enemy key draws what it really is.
- **Scenes talk through events** on `game.events`, named in `src/events.ts`. Game code never draws text and never calls audio; it emits events, and `UI` and `src/audioBridge.ts` act on them. Progress for a run is kept in the registry through `Progress` (`src/state.ts`).
- **Dev helpers** (dev server only, absent from the build): `?level=N`, `?sandbox&room=M`, `?nodamage`, `?gallery2`, and the K key, which clears what is alive and skips waits.

Testing, uploading to itch.io and the pre-submission checklist are in [TESTING.md](TESTING.md).
