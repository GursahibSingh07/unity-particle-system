# unity-particle-system
TGC GameJam 2026 Project

**Light Handler** - a 2D browser game built with [Phaser 4](https://phaser.io/), Vite and TypeScript.

## Plans

- [Game plan](docs/GAME_PLAN.md) - design, scope, milestones
- [Team plan](docs/TEAM_PLAN.md) - roles and day-by-day tasks for 5 people

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

## Project layout

```
index.html          Page that hosts the game
src/main.ts         Phaser game config (size, physics, scene list)
src/scenes/         One file per scene
public/assets/      Images, audio, etc. - loaded as 'assets/<file>'
```
