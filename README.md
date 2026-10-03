# unity-particle-system
TGC GameJam 2026 Project

**Light Handler** - a top-down 2D browser game in the spirit of the early Zelda games, built with [Phaser 4](https://phaser.io/), Vite and TypeScript. You fight monsters with the EMW Machine, switching between kinds of electromagnetic radiation to find each monster's weakness.

All art is pixel art defined in code and all music and sound is synthesised at runtime. There are no image or audio files.

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Left mouse button | Fire |
| 1 - 4 | Switch radiation |

## Documents

- [Design bible](docs/DESIGN.md) - the current design and the art, audio and data contracts
- [Game plan](docs/GAME_PLAN.md) - scope and milestones
- [Team plan](docs/TEAM_PLAN.md) - roles for 5 people
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

Dev-only shortcuts (not in the built game): add `?level=1&room=2` to the URL to jump to a room, `?sandbox` for a test level, `?gallery` to see every sprite, and press K to clear the current wave.

## Project layout

```
index.html          Page that hosts the game
src/main.ts         Phaser game config (size, physics, scene list)
src/scenes/         Boot, Game (the room) and UI (the HUD)
src/entities/       Player and monsters
src/systems/        Weapon, combat, wave spawning, room layout parsing
src/config/         Every tunable number, plus level data
src/art/            Pixel art, defined in code and drawn at startup
src/audio/          Music and sound, synthesised at runtime
```

## AI disclosure

AI tools were used in making this game and are disclosed as the jam rules require: Claude (Anthropic), through Claude Code, wrote code, the code-defined pixel art and audio synthesis, and drafts of the planning documents. No image, audio or 3D generators were used. The concept, theme, story and design direction are the team's. Full details are in [CREDITS.md](CREDITS.md).

## License

[MIT](LICENSE)
