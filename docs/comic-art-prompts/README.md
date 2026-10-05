# Comic art prompts

How to turn the game's pixel art into hand-inked, coloured comic art using AI image tools, with copy-paste prompts for every sprite, background and item in all five art styles.

The pixel art was exported to `art-image/` (run `npm run art:export` to regenerate it). These documents use it as the reference for every prompt, so the AI keeps your poses, silhouettes and layouts and only changes the *drawing*.

## Read in this order

| File | What is in it |
| --- | --- |
| [01-tools-and-workflow.md](01-tools-and-workflow.md) | Which AI to use with a Gemini Pro subscription (and what to add if it isn't enough), the step-by-step pipeline, background removal, slicing, and the final size of every asset |
| [02-style-bible.md](02-style-bible.md) | The five era style blocks, the technical block, key colours. Pasted into every prompt, so all assets of an era match |
| [03-characters.md](03-characters.md) | Hero, EMW Machine, and all 12 monsters with the ordinary people they really are, plus the Prism boss and the police car. Frame by frame |
| [04-backgrounds.md](04-backgrounds.md) | The city square in each era, with the layout rules that stop it breaking gameplay, an alignment check, and the "over" layer and cracked-wall decals |
| [05-items-effects-extras.md](05-items-effects-extras.md) | Heart, upgrade, spark, ray icons, era icons, projectiles, hazards, and optional cover art, hit-word bursts and the pause book |

## The five styles

The game is one city square drawn five ways. Each era draws less than the one before, and the last one shows the truth.

| Style key | Era | Look |
| --- | --- | --- |
| `goldenAge` | Golden Era | Bright sunshine, 1940s-50s comic, every detail, Ben-Day dots |
| `cyberpunk` | Cyberpunk Era | Dusk, violet shadows, neon cyan / pink / amber / lime, fewer details |
| `retro` | Retro Era | Dark and dull, five tones plus rust, like a tired handheld screen |
| `manga` | Manga Era | Black ink on white paper, one grey as screentone, minimal detail |
| `plain` | Ending | An ordinary overcast afternoon, soft brown lines. The monsters are revealed to be ordinary people |

`plain` is not a recolour. Every monster is replaced by the person it really was (the rat is a pigeon, the golem is a delivery man, the boss is a police car), so it needs its own prompts. They are written out in file 03.

## Recommended order of work

1. **Read file 01** and make the upscaled reference images (one shell loop, a few seconds).
2. **Do one era all the way through first.** Use `goldenAge`: make the three style anchors, then the hero, one enemy and the background. Fix the process on this one era before repeating it four more times.
3. **Do `plain` second.** It is the ending and it carries the twist, so it matters most to how the game lands.
4. Then Cyberpunk, Retro, Manga.
5. Shared items last (file 05, part A). They are only done once.

## How much work this is

About **100 distinct generations** for a complete set (15 hero rows, 5 machines, 60 enemy and people sheets, 5 backgrounds, 5 crack decals, 10 items and effects), and realistically **2 to 3 times that** with retries. Gemini's daily image limits depend on your plan and change over time, so check yours. Expect it to take a few days of sessions, not one.

If you want to cut scope, the players only ever see each monster in the era it appears in (see `docs/DESIGN.md`), so you can skip the combinations that never appear. File 03 ends with a note on which.

## What I can't do for you

I can't generate or look at AI images from here, so these prompts are written from the code and the pixel art, not tested against Gemini. Expect to adjust wording after your first few results. The most likely changes are:

- A style block that comes out too soft or too glossy: add the NEGATIVE block from file 02.
- A sheet whose frames don't line up: switch to one frame per generation (file 01, step 4).
- A background that moves a building: use the alignment check and the "trace first" method (file 04).

## What I can do next

- **Wire the finished PNGs into the game**: load them in `Boot.ts` under the same texture keys, with a smaller display scale for the larger images, and keep the code-drawn art as a fallback for anything you haven't replaced yet.
- **Write a helper script** that takes a raw AI sheet, removes the key colour, slices it into frames, aligns the feet and writes the files into `art-image-comic/` with the right names.
- **Make a contact sheet page** (like the dev-only `?gallery2`) for comparing the comic and pixel versions side by side.
