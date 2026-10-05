# Light Handler: Design Bible (v2)

The working contract for art, audio, eras and code. The design comes from the team's `docs/ideas.md`; where the ideas left a gap, the choice made here is marked **(default)** and is the team's to change. If you change something here, tell everyone who builds against it.

Jam rules (`docs/rules.md`) that shape everything: a complete loop of 10-15 minutes; all three themes (Comic, Twist, Light); fresh original code; only free or self-made assets, credited; AI use disclosed.

## v2.1 changes (from docs/ideas.md, 5 October 2026)

These override anything below that disagrees.

- **Era names:** Golden Era, Cyberpunk Era, Retro Era, Manga Era, Boss Era.
- **Golden is timed too:** a two-minute clock; waves keep arriving until it runs out (rats, then slimes and bats, then the Ironclad, then the Golem), with checkpoints and a surge like the other eras.
- **Green:** half the damage (13), half the burst area (radius 13), and the slowing puddle it leaves lasts 7 seconds.
- **Stealth:** a hidden ghost, and the boss while hidden in its Retro phase, take no damage at all until UV reveals them.
- **Boss:** every era switch brings company, one enemy on the first switch and one more each time (up to six), of kinds that suit the era switched to. The warning before a switch is 2 seconds.
- **Manga:** enemies arrive twice as fast (cap raised from 14 to 24).
- **Demo mode:** when it is on, keys 1-5 on the pause screen's Pages tab jump to that era in the middle of a game.

## v2.5 changes (from docs/ideas.md, 5 October 2026)

- **Boss:** three dashes between era switches (was two), a 3 second warning before each switch, and a tenth less health (1120 to 1008).
- **God mode:** a setting, on the cover's settings sheet and in the pause book. Nothing hurts the player while it is on; it can be switched mid-era.
- **Armour:** 15% less health (Ironclad 130 to 110, Golem 260 to 221).
- **Rays:** White does 16 (was 12). UV stuns for 0.2 seconds. Green does 11 uncharged and 16 fully charged.

## v2.4 changes (from docs/ideas.md, 5 October 2026)

- **Boss company:** two arrive with every era switch, and never more than four are alive beside the boss.
- **Boss length:** a fifth shorter (health 1400 to 1120).
- **Boss weapon:** v2.3's "everything always available" is taken back. Each phase the machine obeys that era's rule again (no Blue in Cyberpunk; overdrive, a self-turning wheel and UV in Retro; White only in Manga). The dash is kept throughout.
- **Boss health bar:** shown in the middle of the top strip for the whole fight.

## v2.3 changes (from docs/ideas.md, 5 October 2026)

- **Boss company:** at most 3 arrive with one era switch, and never more than 5 are alive beside the boss (with 4 there, a switch brings 1). Armour enemies lead each era's list.
- **Boss weapon:** all three kinds of light (the colour wheel, White, UV) stay available through the whole fight, whatever era the boss has switched to. The era still sets how the machine behaves: overdrive and the self-turning wheel in Retro.
- **Collisions:** bodies are boxes, not circles, and wall tiles are merged into long strips, so the player and enemies slide along walls and round corners without snagging.
- **Armour shows up:** the Ironclad comes at 0:40 and the Golem at 1:05 in Golden, both more often; Ironclads and Golems are added to Cyberpunk and Retro and to the boss's company.
- **Blue:** damage 16 (was 12), and 1.5x against swarm enemies.
- **Pause screen:** an open comic book of two-page spreads (eras and stats; Field Guide; the machine; settings with an exit to the cover), with a page-turn animation and its own comic fonts and colours.

## v2.2 changes (from docs/ideas.md, 5 October 2026)

- **Green charge:** any tap fires. An uncharged blob does two thirds of the damage (what a full charge kills in two hits, a tap kills in three) and travels a short way (30 units); a full charge travels the full 132.
- **White:** the ring's radius is 20% smaller (46 to 37).
- **UV:** the cone also stuns everything in it for 0.1 seconds.
- **Field Guide:** in demo mode only, each page also names the rays that enemy is weak to.
- **Weapon guide:** a new pause tab, THE MACHINE, explains every ray with the numbers the game uses. In demo mode it also lists the enemies each ray is strong against.

## 1. The game in one paragraph

A top-down action game in the look of a 16-bit console RPG. The Light Handler defends a city square with the EMW Machine, turning its colour wheel to match the ray to the enemy. The square is the same place in every era, but each era it is drawn with less: fewer details, fewer colours. The Handler has schizophrenia and it is getting worse, and the player sees the world drain as he does. In the ending the detail returns, in plain daylight: there were never any monsters, he has been shining a pocket torch at passers-by, and he is arrested for causing mild annoyance to the public.

## 2. Structure (about 12 minutes)

One level per era. Every era is the same city square (`src/config/square.ts`).

| # | Era (`ArtStyle`) | Look | Spawning | Given at the start | Rule | Time |
| --- | --- | --- | --- | --- | --- | --- |
| - | Cover + intro | - | - | - | - | 0.5 |
| 1 | Golden (`goldenAge`) | Bright sunshine, every detail, bright monsters | 4 waves | Red, Blue, Green rays | Full wheel, no dash | 2.5 |
| 2 | Cyberpunk (`cyberpunk`) | Dusk, neon, fewer details, duller monsters | Continuous, 2:00 | Dash | Blue is taken away; dash, 3s cooldown | 2 |
| 3 | Retro (`retro`) | Dark, dull, fewer details still | Continuous and dense, 2:00 | Double dash, UV lens | Overdrive; wheel locked and turning by itself; two dashes, 5s cooldown; UV mode | 2 |
| 4 | Manga (`manga`) | Black and white, sharp outlines, almost no detail | Continuous bullet hell, 2:00 | Unprism (White) | Locked to White | 2 |
| 5 | Boss (`finalPage`) | Swaps era with the boss | The Prism | - | Whatever era the boss has switched to | 2 |
| - | Ending (`plain`) | Full detail returns, natural daylight | - | - | A pocket torch | 1 |

- **Golden's four waves** introduce: 1 rats, 2 slimes and bats, 3 Ironclad, 4 Golem.
- **Timed eras** end when the clock runs out, after a final surge. Dying restarts from the last 45-second checkpoint **(default)**, so the length does not depend on skill.
- **First appearances** of the other classes: speed enemies in Cyberpunk (zig-zag bat first, then the skitter), stealth in Retro (ghost first, then the wraith), projectile in Manga (snowman and acid slime).

## 3. Design pillars

1. **Teach by play, not text.** Each enemy first appears alone or in a gentle mix.
2. **Hide what helps to hide.** Multipliers are never stated. The player learns them from the comic hit words: big for a strong ray, tiny and grey for a weak one.
3. **The rule of each era is the lesson of each era.** Losing Blue, the locked wheel, White only: each forces a different way to play with the same square and the same hands.
4. **Hidden mercy.** Small hurtbox; a heart waits at the start after two deaths.
5. **Telegraph everything.** Every attack has a visible wind-up. Every spawn is announced.
6. **The world drains.** Same square, less of it each era. The ending gives it all back.
7. **The twist re-reads everything.** Field Guide notes are true of the real thing too.

## 4. Controls (default)

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left mouse button | Fire |
| Q / E | Turn the colour wheel left / right |
| F | Switch mode (RGB, UV, Unprism), when the era allows more than one |
| Space | Dash |
| Esc | Pause (page map, Field Guide, Settings) |

Space also advances captions and cards; a dash must not fire while one is showing.

## 5. The EMW Machine

One shared energy pool. The colour wheel is drawn at the bottom right of the screen.

| Ray (`RayId`) | Mode | Shape | Against classes |
| --- | --- | --- | --- |
| `blue` | RGB | A cone in front that hits everything in it | 1x all |
| `red` | RGB | A straight laser. Strongest up close, falling off with distance: weaker than Blue at full range | 1.5x armor |
| `green` | RGB | Hold to charge, release a blob that slows everything it touches | 2x speed |
| `white` | Unprism | A 360 degree pushback of enemies and projectiles | 1.5x swarm and projectile, 0.25x others |
| `uv` | UV | A cone that reveals stealth enemies and halves their health | 0x others |

The class table lives in `RAY_VS_CLASS` in `src/config/rays.ts` and is read through `damageMultiplier(def, ray)` in `src/systems/Combat.ts`. The boss counts as 1x for Blue, Red and Green, 0.25x for White, 0x for UV, except where its own code says otherwise.

**Weapon rules** (`WeaponRule` in `src/types.ts`, one per era on `LevelDef.rule`):

| Era | `wheel` | `modes` | Other |
| --- | --- | --- | --- |
| Golden | blue, red, green | rgb | no dash |
| Cyberpunk | red, green | rgb | dash: 1 charge, 3000ms |
| Retro | blue, red, green | rgb, uv | overdrive; `autoRotateMs` 5000 (default); dash: 2 charges, 5000ms |
| Manga | (none) | unprism | dash: 2 charges, 5000ms |
| Boss | blue, red, green | rgb, uv, unprism | dash: 2 charges, 5000ms; replaced by an era's rule when the boss switches era |

- **Overdrive:** fires twice as fast, hits twice as hard, drains energy twice as fast.
- **Locked wheel:** Q and E do nothing; the wheel turns by itself every `autoRotateMs`, with a warning tick just before.
- **Dash:** a short burst in the movement direction (or the aim direction when standing still). Nothing can hurt the player during it and he passes through enemies.

## 6. Enemies

| Id | Class | Behaviour | Really is (default) |
| --- | --- | --- | --- |
| `rat` | swarm | Runs at the player in packs | Pigeons, walking |
| `slime` | swarm | Hops at the player in groups, a little tougher | Small dogs on a walker's leads |
| `bat` | swarm | Flies straight at the player over props and the fountain | Starlings |
| `ironclad` | armor | Slow, keeps its distance, throws after a wind-up | A cyclist in a helmet |
| `golem` | armor | Rolls slowly at the player; rays stop at it, so it shields what is behind | A delivery man pushing a loaded trolley |
| `zigbat` | speed | Fast, flies in a zig-zag | A kid weaving through on a scooter |
| `skitter` | speed | Fast; dashes away when hit, so the player must aim again | A jogger |
| `ghost` | stealth | Nearly invisible; dashes after a wind-up; untouchable until UV reveals it | A man in a dark coat |
| `wraith` | stealth | A more aggressive ghost: faster, re-hides sooner, dashes in pairs | The cinema's doorman |
| `snowman` | projectile | Throws snowballs that leave ice on the floor; ice slows the player | An ice-cream vendor |
| `acidSlime` | projectile | Lobs acid that leaves a pool; the pool hurts over time | A window cleaner with a bucket |
| `prism` | boss | See below | A police car |

**The Prism.** It dashes at the player twice (each with a wind-up). Its third attack switches the era: a few seconds beforehand an icon of the coming era shows over its head (`BOSS_TELEGRAPH`), then the whole square redraws in that era and the machine obeys that era's rule (`ERA_SWAPPED`) until the next switch. It cycles Golden, Cyberpunk, Retro, Manga.

**Field Guide.** A page unlocks on the first kill of each enemy. After the ending every page shows what it really was.

## 7. Secrets, hearts, upgrades

- **Secrets:** one per era. A hairline crack in a building wall on the outer ring (`S` in the layout); nothing else gives it away. Only the era's `RoomDef.secret` ray breaks it. When it breaks, a health upgrade (+2 blocks) drops onto the floor in front of it.
- **Hearts:** enemies drop one now and then, more often when the player is low. After two deaths at the same checkpoint a heart waits at the start. Never announced.
- **Upgrades** are handed over as an era begins (`LevelDef.grants`), each on an item card. There are no chests.

## 8. Settings and demo mode

`src/settings.ts`, saved in the browser: music volume, sound volume, screen shake, demo mode. Reached from the cover and from the pause screen. With demo mode on, the cover offers every era to start from, with that era's upgrades already owned.

## 9. Technical contract

### Coordinates and scale

- The world is **320x180 units**, shown at **zoom 4** on a 1280x720 canvas. Tiles are 16 units. The square is 20 by 10 tiles under a 20-unit HUD strip. Every speed, range and radius is in world units.
- **v2 art has 2 texture pixels per world unit:** a tile is 32x32 pixels, a character 32x48. Sprites are therefore shown at `ART_SCALE` (`src/config/world.ts`). Every world sprite goes through `worldScale(sprite)` and every circular body through `fitCircleBody(sprite, radius)` (`src/systems/artScale.ts`); never hard-code a scale or pass world radii straight to `setCircle` on a scaled sprite.
- `ART_SCALE` is 1 while the old art is in use. The Director flips it to 0.5 when the v2 art is switched on. Code written through the helpers works with both.
- **All text lives in the UI scene** (unzoomed, 1280x720). World point to UI point is x4.

### The square's layout

`src/config/square.ts` holds the one layout. Legend (`src/systems/roomLayout.ts`):

| Char | Meaning |
| --- | --- |
| `#` | Building wall (blocks movement and rays) |
| `.` `,` | Paving, worn paving |
| `o` | Street furniture (blocks movement, not rays) |
| `F` | Fountain (blocks movement, not rays) |
| `e` | Street entry: open floor; enemies walk in from here |
| `P` | Player start |
| `S` | A cracked wall on the outer ring (secret) |

Flying enemies ignore `o` and `F`. `C` and `H` from v1 are no longer used.

### v2 art (owned by `src/art/v2/`)

Entry point: `bakeArtV2(scene)` in `src/art/v2/index.ts`. The game keeps using the old `bakeArt` until the Director switches over. `?gallery2` shows the v2 contact sheet.

`{style}` is each of `goldenAge`, `cyberpunk`, `retro`, `manga`, `plain`. Sizes are texture pixels.

| Key | Frame | Frames |
| --- | --- | --- |
| `city-{style}` | 640x320 | One picture of the whole square: paving, buildings on the ring, furniture, fountain. Must match `SQUARE_LAYOUT` tile for tile |
| `city-{style}-over` | 640x320 | Transparent layer drawn above characters: lamp heads, awnings, anything a person walks behind |
| `crack-{style}` | 32x32 | 0 hairline crack (to overlay on a wall tile), 1 broken open |
| `player-{style}` | 32x48 | Per direction (down, up, left, right): idle, walk A, walk B, dash. 16 frames |
| `machine-{style}` | 24x12 | 0, pointing right, origin at its left end |
| `rat-{style}` | 16x16 | 0-1 move |
| `bat-{style}`, `zigbat-{style}` | 24x24 | 0-1 flap |
| `slime-{style}`, `skitter-{style}` | 32x32 | 0-1 move |
| `ghost-{style}`, `wraith-{style}` | 32x32 | 0-1 move, 2 wind-up |
| `ironclad-{style}`, `snowman-{style}`, `acidSlime-{style}` | 32x32 | 0-1 move, 2 wind-up |
| `golem-{style}` | 48x48 | 0-3 roll |
| `prism-{style}` | 64x64 | 0-1 move, 2 wind-up |
| `projectiles-{style}` | 16x16 | 0 thrown thing (ironclad), 1 snowball, 2 acid glob, 3 prism shard |
| `hazards-{style}` | 32x32 | 0 ice patch, 1 acid pool |
| `heart` | 16x16 | 0 |
| `upgrade` | 16x16 | 0 health upgrade |
| `spark` | 8x8 | 0 white particle |
| `icons` | 24x24 | 0 blue, 1 red, 2 green, 3 white, 4 uv, 5 dash |
| `era-icons` | 24x24 | 0 goldenAge, 1 cyberpunk, 2 retro, 3 manga (shown over the boss's head) |

Animations at 8 frames a second, looping: `player-{style}-walk-{down|up|left|right}` (idle, A, idle, B), `{enemy}-{style}-move`.

**Detail must fall era by era, in the drawing and not only the palette.** Golden has everything: window frames, signs, awnings, flowers, cobbles, shadows from the sun. Cyberpunk keeps the buildings but loses small details and lights them with neon at dusk. Retro is darker and duller with flat walls and few windows. Manga is black and white with sharp outlines and almost nothing inside them. `plain` is the real square in ordinary daylight with all the detail back, and in `plain` every enemy key draws what it really is (section 6) and the machine is a pocket torch. Enemies follow the same curve: bright and detailed in Golden, dull in Cyberpunk and Retro, outlines in Manga.

### Audio (owned by `src/audio/`)

Synthesised at runtime; no files. The `audio` API is unchanged (`unlock`, `playMusic`, `stopMusic`, `sfx`, `setLoop`, `setVolume`). New ids for v2:

- `MusicId` adds `cyberpunk` and `retro` (the old `noir` track becomes `retro`).
- `SfxId` adds `blue`, `red` is a loop, `greenRelease`, `white`, `uv`, `dash`, `dashReady`, `wheel`, `wheelLocked`, `mode`, `checkpoint`, `surge`, `ice`, `acid`, `upgrade`, `bossTelegraph`, `eraSwap`.
- `LoopId` adds `red` (the laser) and `greenCharge`.

### How the pieces talk

- Cross-scene communication goes through `scene.game.events` with the names and payloads in `src/events.ts`. Gameplay code never draws text and never calls audio; it emits events.
- Progress for a playthrough is in the registry through `Progress` (`src/state.ts`).
- Words the player reads are in `src/config/text.ts`.

**Between the machine and the enemies** (so the two can be built separately):

| Provided by enemies (`Monster`) | Used by the machine |
| --- | --- |
| `def` (with `class`, `radius`), `x`, `y`, `active` | Targeting |
| `takeDamage(ray, amount): boolean` | Applies `damageMultiplier`; false if it did nothing |
| `knockback(fromX, fromY, speed, ms)`, `stun(ms)`, `slow(factor, ms)` | White's push, Green's slow |
| `exposeToUv(): boolean` | UV: a stealth enemy is revealed and loses half its health (not more than once a second); others return false |
| `blocksRays: boolean` | True for the Golem: Blue, Red and Green stop at it |
| `flying: boolean` | Bats |
| Projectiles in `world.projectiles`, each with `deflect(fromX, fromY, speed)` | White pushes them away |

| Provided by the player (`Player`) | Used by enemies and hazards |
| --- | --- |
| `x`, `y`, `isDead` | Targeting |
| `hurt(amount): boolean` | False while dashing or just hit |
| `isDashing: boolean` | Contact is ignored while true |
| `speedScale: number` | Ice sets it below 1 and restores it |

### File ownership

Wave A:

| Folder | Owner |
| --- | --- |
| `src/art/v2/city/` | Art: environment |
| `src/art/v2/` (everything else) | Art: characters |
| `src/audio/` | Audio |
| `src/systems/EMWMachine.ts`, `src/systems/Combat.ts`, `src/systems/rayEffects.ts`, `src/entities/Player.ts`, `src/config/rays.ts` | Weapons |
| `src/entities/` (except `Player.ts`), `src/config/monsters.ts`, `src/systems/Navigation.ts`, `src/systems/WaveDirector.ts`, `src/config/levels/sandbox.ts` | Enemies |
| `src/scenes/Game.ts` | Shared by Weapons and Enemies: small, marked insertions only; re-read before every edit |

Wave B:

| Folder | Owner |
| --- | --- |
| `src/config/levels/` (except sandbox), `src/config/text.ts`, `docs/LEVELS.md` | Eras and narrative |
| `src/scenes/Game.ts`, `src/scenes/Ending.ts`, `src/systems/` (flow parts) | Flow |
| `src/scenes/UI.ts`, `src/scenes/Title.ts`, `src/ui/` | Interface |
| `tests/`, `tools/`, `docs/TESTING.md` | QA |

Always the Director's: `src/main.ts`, `src/scenes/Boot.ts`, `src/types.ts`, `src/events.ts`, `src/state.ts`, `src/settings.ts`, `src/audioBridge.ts`, `src/config/world.ts`, `src/config/square.ts`, `src/art/index.ts`, this file.

### Dev helpers (dev server only)

`?level=N` starts era N. `?sandbox` and `?sandbox&room=M` open the test level. `?nodamage` makes the player invulnerable. `?gallery` and `?gallery2` show the old and v2 art sheets. K kills everything alive and skips waits. `window.__game` is the Phaser game.
