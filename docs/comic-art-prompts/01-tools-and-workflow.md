# 01. Tools and workflow

## Which AI to use (you have Gemini Pro)

Start with what you already pay for. Gemini's native image model (the "Nano Banana" family) takes reference images and edits them, which is what this job needs. You are restyling existing art, not inventing it.

| Tool | Use it for | Notes |
| --- | --- | --- |
| **Gemini app** (gemini.google.com), image mode | Everything in these docs. Start here. | Attach up to several reference images per prompt. Pro gives higher daily limits and, depending on your plan, the stronger image model. Check the model picker, as names and limits change. |
| **Google AI Studio** (aistudio.google.com) | The same models with a cleaner interface, and the choice of aspect ratio. Good for the backgrounds. | Free tier limits are tighter than the app, so use it as overflow. |
| **Google Whisk / Flow** (Labs) | Style anchoring: feed a *style* image and a *subject* image separately. | Availability depends on your plan and region. Try it if Gemini drifts on style. |
| **Rembg / Photopea** (free) | Removing the flat background after generation. | `pip install "rembg[cli]"`, then `rembg i in.png out.png`. Photopea is a free browser Photoshop. |
| **ImageMagick + Pillow** (already on this machine) | Upscaling the pixel references, slicing sheets, resizing. | Commands below. |

If you outgrow Gemini (usually because ~100 assets must look like one artist drew them), these are better, in order:

1. **Scenario** (scenario.com). Built for game assets. Train a small style model on your 10 best approved images, then every later generation matches. This is the best fix for consistency, but it is paid.
2. **Krita + the "AI Diffusion" plugin** (free, runs locally, needs a decent GPU). Lets you feed the pixel sprite in as a *structure* guide (ControlNet), so poses and silhouettes are followed exactly. Best fidelity to your existing layouts.
3. **Midjourney.** Best raw style quality (`--sref` for style, `--oref` for character), but it is the weakest at following an exact layout. Good for the era style anchors, risky for backgrounds that must match a collision map.

You do not need any of them to start.

## Be realistic about what AI will and won't do

- **Sheets won't be pixel-perfect.** Gemini can't guarantee exact grids, equal frame spacing or identical characters across frames. Plan to slice and nudge by hand, or generate frames one at a time.
- **Transparency isn't supported.** Always generate on a flat solid colour, then remove it (step 5).
- **Aspect ratios are limited.** The square is 2:1, which most models don't offer. Generate at 16:9 or wider and crop (see [04-backgrounds.md](04-backgrounds.md)).
- **Backgrounds must match the collision map.** Buildings, entries, lamps and the fountain are at fixed tiles in `src/config/square.ts`. Gemini will happily redesign the square, which breaks gameplay. Every background prompt therefore attaches the pixel version as a layout guide.
- **Manga is black and white on purpose.** The game design says the Manga era is "black and white outlines". The prompts keep that. A coloured variant is noted in the style bible if you want it.

## The pipeline

### 1. Make reference images (once)

The exported pixel art is tiny. Upscale it with nearest-neighbour so it stays crisp, otherwise the AI sees mush.

```bash
cd /home/harshyy/Desktop/GameJam/unity-particle-system
mkdir -p art-image-ref

# Every sheet, 8x, with a mid-grey background so the silhouette reads
for f in art-image/sprites/*/*.png art-image/shared/*.png; do
  out="art-image-ref/$(echo "$f" | sed 's|art-image/||; s|/|_|g')"
  convert "$f" -background '#808080' -alpha remove -filter point -resize 800% "$out"
done

# Backgrounds, 3x
for f in art-image/city/*/*.png; do
  out="art-image-ref/$(echo "$f" | sed 's|art-image/||; s|/|_|g')"
  convert "$f" -background '#808080' -alpha remove -filter point -resize 300% "$out"
done
```

To use a single frame as the reference, take it from `art-image/sprites/{style}/frames/{sprite}/` and upscale the same way.

### 2. Lock one style anchor per era

Before generating any asset, make **three images per era** and keep only the best:

1. The hero (front-facing idle).
2. One building front (the town hall).
3. One enemy (the rat, or the pigeon in `plain`).

Use the era style block from [02-style-bible.md](02-style-bible.md). Iterate until the three look like the same artist. These become your **anchors**. Save them in `art-image-comic/_anchors/{era}/`.

Spend real time here. Everything after this is cheap if the anchors are good, and unfixable if they are not.

### 3. Generate each asset

Every prompt is assembled from four blocks:

```
[ERA STYLE BLOCK]  +  [SUBJECT]  +  [LAYOUT]  +  [TECH BLOCK]
  02-style-bible      03/04/05       in each      02-style-bible
```

In each Gemini message, attach, in this order:

- **Image 1**: the era's style anchor (for style).
- **Image 2**: the upscaled pixel reference of the asset (for pose, silhouette, proportions).

Then paste the assembled prompt. Start the prompt with this line so Gemini knows what each image is for:

> Image 1 is the style reference: copy its linework, colour treatment and shading, not its subject. Image 2 is a pixel-art layout reference: keep its pose, silhouette, proportions and frame order, but redraw it completely as hand-inked comic art. Do not copy the pixels.

### 4. Get consistent frames

Animation frames drift easily. In order of preference:

1. **One image per sheet.** Ask for all frames in a row (the LAYOUT blocks do this). Fastest, and usually the most consistent, because the model sees all frames at once.
2. **Frame 1, then edits.** If the sheet comes back with different-looking characters, generate frame 1 alone. Then, with frame 1 attached, say: *"Same character, same outfit, same colours, same line weight. Redraw in this pose: [pose]."*
3. **Fix single frames.** Attach the sheet and say *"Redraw only frame 3. Keep everything else identical."*

Left-facing hero frames are a **mirror of the right-facing ones** in the game code, so generate down, up and right only (12 frames) and flip the fourth row.

### 5. Remove the background

Every TECH block asks for a flat key colour. Default **magenta `#FF00FF`**. Use **lime `#00FF00`** for assets that are mostly pink, purple or neon-pink (Cyberpunk buildings and signs, the ghost, the wraith). Use **white `#FFFFFF`** only for Manga, and only if you will clean it with `rembg`, since manga paper is white too.

```bash
# Chroma key (ImageMagick)
convert in.png -fuzz 12% -transparent '#FF00FF' out.png

# Or ML cut-out, better for lineart edges
rembg i in.png out.png
```

Always check the edges at 400% zoom. Pink fringes mean the fuzz value is too low. Eaten outlines mean it is too high.

### 6. Slice and size

Crop each frame to the same cell size, aligned on the feet (bottom-centre). Misaligned baselines make the sprite jitter when animated.

```bash
# Equal-width frames out of a row sheet (change 4 to the number of frames in the sheet)
convert sheet.png -crop 4x1@ +repage +adjoin frame_%02d.png

# Final size, smooth downscale (comic art is not pixel art, don't use point)
convert frame.png -resize 128x192 -background none -gravity south -extent 128x192 out.png
```

### 7. Put them in the game

Save to `art-image-comic/` mirroring `art-image/` (same folder names and file names). The game still draws from code at boot, so a code change is needed to load these PNGs instead, plus a smaller display scale for the larger images. That is a separate task, and I can do it once you have images.

## Output sizes

The game shows 1 texture pixel as 2 screen pixels. Export at **4x the original frame size** so the art stays sharp on large or high-DPI screens. If you pick a different factor, the display scale will be divided by the same number.

| Asset | Original frame | Export frame (4x) | Frames |
| --- | --- | --- | --- |
| Hero | 32 x 48 | 128 x 192 | 16 (12 unique) |
| Machine | 24 x 12 | 96 x 48 | 1 |
| Rat / pigeon | 16 x 16 | 64 x 64 | 2 |
| Slime / dog | 32 x 32 | 128 x 128 | 2 |
| Bat / starling | 24 x 24 | 96 x 96 | 2 |
| Ironclad / cyclist | 32 x 32 | 128 x 128 | 3 |
| Golem / courier | 48 x 48 | 192 x 192 | 4 |
| Zig-zag bat / scooter kid | 24 x 24 | 96 x 96 | 2 |
| Skitter / jogger | 32 x 32 | 128 x 128 | 2 |
| Ghost, wraith, snowman, acid slime and their people | 32 x 32 | 128 x 128 | 3 each |
| Prism / police car | 64 x 64 | 256 x 256 | 3 |
| Projectiles | 16 x 16 | 64 x 64 | 4 |
| Hazards | 32 x 32 | 128 x 128 | 2 |
| Heart, upgrade | 16 x 16 | 64 x 64 | 1 each |
| Spark | 8 x 8 | 32 x 32 | 1 |
| Ray icons | 24 x 24 | 96 x 96 | 6 |
| Era icons | 24 x 24 | 96 x 96 | 4 |
| City (base and over) | 640 x 320 | 2560 x 1280 | 1 each |
| Crack | 32 x 32 | 128 x 128 | 2 |
