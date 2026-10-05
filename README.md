# unity-particle-system
TGC GameJam 2026 Project

**Light Handler** - a top-down 2D browser game in a 32-bit console look, built with [Phaser 4](https://phaser.io/), Vite and TypeScript. You defend a city square with the EMW Machine, turning its colour wheel to match the ray to the enemy. The square is the same place in every era, but each era it is drawn with less.

All art is pixel art defined in code and all music and sound is synthesised at runtime. There are no image or audio files.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left mouse button | Fire |
| Q / E | Turn the colour wheel |
| F | Switch mode (RGB, UV, Unprism) |
| Space | Dash |
| Esc | Pause: the pages, the Field Guide, Settings |

## Documents

- [Design](docs/DESIGN.md) - the game as it is now: eras, rays, enemies, secrets, how it is built
- [Changelog](docs/CHANGELOG.md) - the team's design notes, version by version
- [Original proposal](docs/proposal.pdf)
- [itch.io page text](submission.txt)
- [Testing, uploading and the pre-submission checklist](docs/TESTING.md)
- [Jam rules](docs/rules.md)
- [Credits and AI disclosure](CREDITS.md)

## Running the game

Requires [Node.js](https://nodejs.org/) 22 or newer.

```
npm install
npm run dev
```

Then open http://localhost:5173/. The page reloads automatically when you save a file.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build the game into `dist/` |
| `npm run preview` | Serve the built `dist/` folder locally |
| `npm run typecheck` | Type-check without building |

Dev-only shortcuts (not in the built game): add `?level=3` to the URL to start at an era, `?sandbox` for a test level, `?nodamage` to be invulnerable, `?gallery2` to see every sprite, and press K to clear what is alive. Players can start from any era by turning on demo mode in Settings.

## Project layout

```
index.html          Page that hosts the game
src/main.ts         Phaser game config (size, physics, scene list)
src/scenes/         Boot, Title, Game (one era), Ending and UI (the HUD)
src/entities/       Player and monsters
src/systems/        The machine and its rays, spawning, timed eras, pathfinding, layout parsing
src/config/         Every tunable number, plus level data
src/art/            Pixel art, defined in code and drawn at startup
src/ui/             HUD, colour wheel, captions, cards, the pause book
src/audio/          Music and sound, synthesised at runtime
```

## AI disclosure

AI tools were used in making this game and are disclosed as the jam rules require: Claude (Anthropic), through Claude Code, wrote code, the code-defined pixel art and audio synthesis, and drafts of the planning documents. No image, audio or 3D generators were used. The concept, theme, story and design direction are the team's. Full details are in [CREDITS.md](CREDITS.md).

## License

[MIT](LICENSE)
