# Light Handler: Design Bible

The working contract for art, audio, levels and code. If you change something here, tell everyone who builds against it. The team owns the design decisions in this file: edit them freely.

## 1. The game in one paragraph

A top-down action game in the spirit of the early Legend of Zelda games. The Light Handler fights monsters with the EMW Machine, switching between kinds of electromagnetic radiation to match each monster's weakness. Each level is a comic page in a different comic style. The ending reveals there were never any monsters: he has schizophrenia, he has been shining a torch at passers-by, and he is arrested for causing mild annoyance to the public.

## 2. Structure (about 12.5 minutes)

| Part | Style | Rooms | Chest after room 1 | New monsters | Time |
| --- | --- | --- | --- | --- | --- |
| Cover + intro | Comic cover | - | (start with Radio) | - | 0.5 min |
| Level 1 | Golden Age | 3 | Infrared | Swarmlet, then Frostling | 2.5 min |
| Level 2 | Noir | 3 | Ultraviolet | Shade | 3 min |
| Level 3 | Manga | 3 | Gamma | Ironclad | 3 min |
| Boss | Swaps per phase | 1 | - | The Prism | 2.5 min |
| Ending | Plain | - | - | - | 1 min |

The rules require 10-15 minutes. Playtime past 20 minutes is not judged.

## 3. Design pillars

1. **Teach by play, not text.** The first room is safe. Each new monster first appears alone. No tutorial pop-ups.
2. **Hide what helps to hide.** Weaknesses are never stated. The player learns them from feedback: a big "FZZT!" for a weakness, a small "tink" for a resist.
3. **Hidden mercy.** The player's hurtbox is smaller than the sprite. After two deaths in the same room, a heart appears at the start.
4. **Telegraph everything.** Every monster attack has a visible wind-up. Spawns are announced before the monster appears.
5. **Every level gives something.** The player starts with Radio only. In each level, room 1 is cleared with the tools already owned; a chest then appears holding that level's new radiation (item-get jingle), and rooms 2 and 3 are built around using it. The boss needs all four.
6. **One secret per level.** A cracked wall that only one radiation breaks, hiding a health upgrade worth +2 health blocks.
7. **The twist re-reads everything.** Field Guide entries and the page map are written so the ending changes their meaning.

## 4. Metagame

- **Field Guide.** The Handler's notebook. An entry unlocks the first time a monster is killed, written in his confident voice. After the ending each entry shows its real meaning.
- **The page map.** The pause screen is a comic page. Each cleared room is an inked panel. At the ending the same page is redrawn as a police incident report.

## 5. Radiation

One shared energy pool. Keys 1-4 select, left mouse fires.

| Key | Type | How it fires | Weakness of |
| --- | --- | --- | --- |
| 1 | Radio | Ring pulse around the player, knockback | Swarmlet |
| 2 | Infrared | Continuous beam, stopped by walls | Frostling |
| 3 | Ultraviolet | Short wide cone flash, reveals and stuns | Shade |
| 4 | Gamma | Charged thin ray, passes through walls and armour | Ironclad |

Damage multipliers: weak 2x, neutral 1x, resistant 0.25x (`src/systems/Combat.ts`).

## 6. Monsters

| Monster | Size | Behaviour | Weak to | In the ending, really |
| --- | --- | --- | --- | --- |
| Swarmlet | 8x8 | Flocks at the player in groups | Radio | Pigeons |
| Frostling | 16x16 | Chases directly | Infrared | An ice-cream vendor |
| Shade | 16x16 | Nearly invisible, dashes; untouchable until revealed | Ultraviolet | A man in a dark coat |
| Ironclad | 16x16 | Slow, armoured, throws projectiles after a wind-up | Gamma | A cyclist in a helmet |
| The Prism | 32x32 | Four colour phases, one weakness each; spawns minions | Cycles | A police car |

## 7. Technical contract

### Coordinates

- The world is **320x180 units**, drawn by the Game scene's camera at **zoom 4** onto a 1280x720 canvas. Constants are in `src/config/world.ts`.
- **Tiles are 16x16.** A room is 20 columns by 10 rows, placed below a 20-unit HUD strip.
- **All text lives in the UI scene**, which is not zoomed (1280x720 coordinates). To place UI over a world point, multiply world coordinates by 4.
- Rendering uses nearest-neighbour filtering (`pixelArt: true`).

### Room layouts

`RoomDef.layout` is 10 strings of 20 characters:

| Char | Meaning |
| --- | --- |
| `#` | Wall (blocks movement, Infrared and Ultraviolet) |
| `.` | Floor |
| `,` | Floor, decorative variant |
| `o` | Prop (blocks movement, does not block radiation) |
| `P` | Player start (floor) |
| `C` | Chest (floor until the room is cleared; then a chest holding `RoomDef.reward`) |
| `S` | Secret wall (looks like a cracked wall; only `RoomDef.secret` radiation breaks it) |
| `H` | Health upgrade (floor with a pickup on it; put it behind an `S`) |

The outer ring must be `#`. Exactly one `P` per room. A room with a `reward` needs exactly one `C`; a room with `S` tiles needs a `secret` and one `H` that is unreachable until an `S` breaks.

### Flow between scenes

`Boot` -> `Title` -> `Game` (one room at a time, restarted per room) -> `Ending` -> `Title`. The `UI` scene runs on top of `Game` and `Ending` the whole time.

- Progress for the current playthrough (unlocked radiation, cleared rooms, Field Guide pages, secrets, bonus health) lives in the registry through `Progress` in `src/state.ts`.
- The Game and Ending scenes never draw text. They emit events and the UI scene shows captions, item-get cards, the pause page, the report card and credits, then answers with `DIALOG_DONE` or `SCREEN_DONE` (see `src/events.ts`).
- All player-facing words live in `src/config/text.ts`.

### Styles

`StyleId`: `goldenAge`, `noir`, `manga`, `plain` (the ending), `finalPage` (boss, cycles the others).

Sprites are drawn once as grids of palette indices and baked once per style palette.

| Style | Palette direction |
| --- | --- |
| goldenAge | Four-colour print: saturated red, yellow, blue, with black ink outlines and off-white paper |
| noir | Greys from near-black to white, one accent colour for radiation only |
| manga | Pure black and white with a screentone grey |
| plain | Soft, natural, low-saturation daylight colours; nothing looks like a monster |

### Texture keys (owned by `src/art/`)

`{style}` is one of the four palette styles.

| Key | Frame size | Frames |
| --- | --- | --- |
| `tiles-{style}` | 16x16 | 0 floor, 1 floor variant, 2 wall, 3 prop, 4 cracked wall, 5 chest closed, 6 chest open |
| `player-{style}` | 16x16 | 0-1 down, 2-3 up, 4-5 left, 6-7 right (two walk frames each) |
| `machine-{style}` | 12x6 | 0: the EMW Machine pointing right, origin at its left end |
| `swarmlet-{style}` | 8x8 | 0-1 |
| `frostling-{style}` | 16x16 | 0-1 |
| `shade-{style}` | 16x16 | 0-1 |
| `ironclad-{style}` | 16x16 | 0-1 move, 2 wind-up |
| `prism-{style}` | 32x32 | 0-1 |
| `projectile-{style}` | 8x8 | 0 |
| `heart` | 8x8 | 0 full |
| `spark` | 4x4 | 0 white particle |
| `icons` | 12x12 | 0 radio, 1 infrared, 2 ultraviolet, 3 gamma (for the HUD) |

In the `plain` style the monster keys draw what they really are (pigeon, ice-cream vendor, man in a coat, cyclist, police car) and `machine-plain` is a pocket torch.

Animations: `player-{style}-walk-{down|up|left|right}` and `{monster}-{style}-move`, 6 frames per second, looping.

Entry point: `bakeArt(scene: Phaser.Scene): void` in `src/art/index.ts`, called once from the Boot scene.

### Audio (owned by `src/audio/`)

Everything is synthesised with the Web Audio API. No audio files.

Entry point: the `audio` object exported from `src/audio/index.ts`:

```ts
audio.unlock(): void                 // call on the first key or mouse press
audio.playMusic(id: MusicId): void   // cross-fades; calling with the current id does nothing
audio.stopMusic(): void
audio.sfx(id: SfxId): void
audio.setLoop(id: LoopId, on: boolean): void
audio.setVolume(music: number, sfx: number): void   // 0 to 1
```

- `MusicId`: `title`, `goldenAge`, `noir`, `manga`, `boss`, `ending`
- `SfxId`: `radio`, `ultraviolet`, `gamma`, `hitWeak`, `hitNormal`, `hitResist`, `monsterDie`, `playerHurt`, `playerDie`, `roomClear`, `itemGet`, `chestOpen`, `secret`, `switch`, `denied`, `heart`, `bossPhase`, `uiSelect`
- `LoopId`: `infrared`, `gammaCharge`

Music direction: chiptune (square, triangle, noise). Golden Age is bright and heroic; Noir is slow with a walking bass; Manga is fast and driving; the boss mixes motifs from all three; the ending is the Golden Age melody played plainly and slowly on one voice.

### Events

Cross-scene communication goes through `scene.game.events` using the names in `src/events.ts`.

### File ownership

| Folder | Owner |
| --- | --- |
| `src/art/` | Art |
| `src/audio/` | Audio |
| `src/systems/`, `src/entities/` | Gameplay |
| `src/config/levels/`, `src/config/text.ts`, `docs/LEVELS.md` | Levels and narrative |
| `src/scenes/Game.ts`, `src/scenes/Ending.ts` | Gameplay (flow) |
| `src/scenes/UI.ts`, `src/scenes/Title.ts`, `src/ui/` | Interface |
| `src/main.ts`, `src/scenes/Boot.ts`, `src/types.ts`, `src/events.ts`, `src/state.ts`, `src/audioBridge.ts`, `src/config/world.ts` | Director |
| `tests/`, `tools/` | QA |
