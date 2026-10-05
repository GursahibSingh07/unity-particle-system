# 02. Style bible

These blocks are pasted at the start (STYLE) and end (TECH) of every prompt in files 03 to 05. Copy them exactly, so that all assets of an era share the same wording.

The game's idea: it is **one city square drawn five ways**, and each era draws *less* than the one before. Golden Age has every detail, then Cyberpunk, Retro and Manga lose detail and colour. `Plain` is the ending, the ordinary daylight truth, where the "monsters" are revealed as passers-by. The prompts keep that ladder of detail on purpose.

| Era (style key) | Look | Detail | Colour |
| --- | --- | --- | --- |
| Golden Age (`goldenAge`) | Bright sunshine, classic 1940s-50s comic | Full | Saturated primaries |
| Cyberpunk (`cyberpunk`) | Dusk and neon | Reduced | Violet shadows, neon cyan / pink / amber / lime |
| Retro (`retro`) | Dark, dull, tired old screen | Low | Five tones plus rust |
| Manga (`manga`) | Ink on paper | Minimal | Black, white, one grey as screentone |
| Plain (`plain`) | Ordinary day, the truth | Full again | Desaturated, soft brown lines |

## Style blocks

### STYLE_GOLDEN

```
Classic Golden Age American comic book art, 1940s-1950s four-colour printing. Confident black ink outlines with clear thick-and-thin line weight, thickest on the outer silhouette. Flat, bright, saturated colours led by primary red, yellow and blue, with a small sunny highlight and one hard shadow tone per colour. Shading with Ben-Day halftone dots and a few crisp hatching strokes. Slightly rounded, friendly, energetic shapes. Full detail: stitching, folds, small props and expressions are all drawn. Sunny, warm daylight, light from the upper left. Looks like an inked and hand-coloured printed comic panel, not a 3D render, not a photo, not airbrushed.
```

### STYLE_CYBER

```
Neon-noir comic book art at dusk. Heavy confident black ink with deep solid shadow shapes and sharp cross-hatching. The whole scene is drenched in deep indigo and violet shadow. Only neon stays bright: electric cyan, hot pink, amber and lime, with soft glow and bloom around lit things and a thin coloured rim light on the edges facing the lights. Colours are slightly muted away from the neon. Moderately reduced detail compared to a sunny scene: fewer small props, simpler textures, bolder shapes. Looks like an inked and digitally coloured graphic novel panel, not a 3D render, not a photo.
```

### STYLE_RETRO

```
Faded, dull comic art in the spirit of an old handheld game screen and cheap newsprint. Only five tones: near-black green-grey, dark olive, mid green-grey, pale sage, plus a single dull rust-brown accent. No bright highlights and no pure white. Thick even black-green ink outlines, flat fills, coarse halftone for shadow. Low contrast and a tired, washed-out mood. Low detail: simple shapes, few small features, no texture. Everything drifts toward the same warm grey. Looks like a worn printed comic, not a 3D render, not a photo.
```

### STYLE_MANGA

```
Black and white manga ink drawing. Only pure black ink and white paper plus one mid-grey rendered as mechanical screentone dots. No colour at all. Expressive brush-pen line with strong line-weight contrast, tapered strokes, solid black fills for shadows and dark objects, bare white paper for lights, a few speed lines where it helps. Minimal detail: bold simple shapes, big areas of white or black, details drawn only where they sell the character. Looks like a clean inked manga page, not a sketch, not grey-washed, not a photo.
```

### STYLE_PLAIN

```
Gentle ordinary-daylight comic illustration in the "ligne claire" tradition: thin, even, soft warm-brown outlines (not black) and flat colour fills with very light shading. Naturalistic, desaturated, slightly dusty colours, nothing glowing and nothing heroic. Everything looks like an everyday slice of life on a grey-blue overcast afternoon. Full detail again: clothing creases, shoelaces, bag straps, small signs of everyday wear. Light from the upper left. Warm, calm, slightly funny and sad. Looks like a printed European comic panel, not a 3D render, not a photo.
```

## Tech blocks

### TECH_SPRITE

Replace `{KEY}` with the flat key colour (see [01](01-tools-and-workflow.md): magenta `#FF00FF` by default, lime `#00FF00` for pink/purple subjects).

```
Output a game sprite on a perfectly flat, solid {KEY} background, with no gradient, no floor, no ground shadow, no vignette and no texture. Draw only the subject. The whole figure is fully visible and never cropped, centred in its cell with equal empty margin on all sides and the feet on the same baseline in every frame. The same character, outfit, proportions, colours and line weight in every frame. Viewpoint: slightly raised, like a top-down adventure game, as in the reference. Crisp clean edges, a clear readable silhouette that still works when shown very small. No text, no watermark, no border, no frame, no labels, no numbers, no extra characters, no scenery.
```

### TECH_BACKGROUND

```
Output a single finished piece of environment art. Keep the exact layout of the reference: every building, doorway, street opening, lamp post, planter and the fountain stay at the same positions and the same relative sizes. Do not add, remove, move or resize any of them. Do not add people, animals, cars, text bubbles, a border, a frame, a watermark or a signature. Readable at a glance because gameplay happens on top of it: keep the open paving calm and low-contrast with no busy patterns, and keep the furniture and building edges clearly outlined.
```

### NEGATIVE (append when a result keeps going wrong)

```
Not pixel art. Not 3D. Not photorealistic. Not anime-style gradients or airbrushing. No blurry edges, no soft glow outlines, no painterly texture, no extra limbs, no duplicated characters, no text.
```

## Key colour cheat sheet

| Subject | Key |
| --- | --- |
| Hero, machine, rat, slime, bat, ironclad, golem, zig-zag bat, skitter, snowman, acid slime, Prism, items | Magenta `#FF00FF` |
| Ghost, wraith (purple), Cyberpunk neon signs and buildings | Lime `#00FF00` |
| Acid slime (green) | Magenta `#FF00FF` |
| All Manga assets | White `#FFFFFF`, then `rembg` |
| All `plain` people | Magenta `#FF00FF` (check the red-uniformed doorman edges) |

## Optional: a coloured Manga variant

The game design says Manga is black and white, so the main prompts keep it. If you want a coloured version for the cover or marketing, use this instead of STYLE_MANGA:

```
Colour manga illustration: clean variable-weight black ink outlines, flat bright cel-shaded colours with one shadow tone, screentone dots for texture, no gradients. Minimal detail, bold simple shapes.
```

## Do not name living artists

Avoid "in the style of [artist]" in these prompts. It can trigger refusals, and it pulls every asset toward one artist's look, which is a problem if you publish the game. Describe the *qualities* instead, as the blocks above do.
