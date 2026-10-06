# Credits

Light Handler was made for TGC GameJam 2026 by Gursahib Singh, Harshil Soni, Abhishek Bhadiyadra, Shardul Kholam and Laveena Jain.

## Third-party assets

| Asset | Used for | Source | License |
| --- | --- | --- | --- |
| Pixelify Sans (font) by Stefie Justprince | All in-game text | https://fonts.google.com/specimen/Pixelify+Sans (bundled via https://www.npmjs.com/package/@fontsource/pixelify-sans) | SIL Open Font License 1.1 |
| Bangers (font) by Vernon Adams | Headings in the pause comic book | https://fonts.google.com/specimen/Bangers (bundled via https://www.npmjs.com/package/@fontsource/bangers) | SIL Open Font License 1.1 |
| Comic Neue (font) by Craig Rozynski | Body text in the pause comic book | https://comicneue.com/ (bundled via https://www.npmjs.com/package/@fontsource/comic-neue) | SIL Open Font License 1.1 |

No other third-party art, audio, models or fonts are used. No paid assets are used.

## Original assets

- **Art:** every sprite and tile is pixel art defined in this repository's source code (`src/art/`) and drawn to textures when the game starts.
- **Hand-made look and weathering:** the paper and grain shader (`src/systems/handmade.ts`) and the weathering of the square (`src/art/v2/city/weather.ts`) are written for this game. It uses widely published GLSL idioms (value noise, a fract-based hash, an ordered-dither formula), and Phaser 4's own bloom filters. No texture files are used.
- **Music and sound:** synthesised at runtime by this repository's own code (`src/audio/`) using the browser's Web Audio API. There are no audio files.

## Libraries and tools

| Tool | Used for | License |
| --- | --- | --- |
| [Phaser 4](https://phaser.io/) | Game framework | MIT |
| [Vite](https://vite.dev/) | Dev server and build | MIT |
| [TypeScript](https://www.typescriptlang.org/) | Language | Apache-2.0 |
| [Vitest](https://vitest.dev/) | Tests | MIT |

## AI disclosure

AI tools were used and are disclosed here as the jam rules require.

- **Claude (Anthropic), through Claude Code**, was used to write code, to write the pixel-art and audio-synthesis source code that produces the game's art and sound, and to draft planning documents.
- No image, audio or 3D generator was used: there are no AI-generated image or audio files in this repository.
- The game concept, theme, story , twist, and design comes from the team (see `docs/proposal.pdf` and `docs/CHANGELOG.md`).
