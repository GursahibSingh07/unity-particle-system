# 05. Items, icons, projectiles, hazards and extras

Assemble each prompt as in [03](03-characters.md): intro line, STYLE block, SUBJECT, LAYOUT, TECH_SPRITE. Pixel references are in `art-image/shared/` (items that are the same in every era) and `art-image/sprites/{era}/` (items drawn once per era).

## Part A. Shared items (drawn once, used in every era)

These textures have no per-era versions, because they look the same in every era. Generate **one** version each. Use **STYLE_GOLDEN**, the fullest style, so they stay readable whatever era is on screen. If you would rather have them match each era, ask for five versions and tell me. It is a small code change.

### Heart (health pickup)

Reference: `shared/heart.png`. 16 x 16, **1 frame**. It must read at 32 screen pixels.

```
A single plump red heart, bold black outline, a bright white highlight on the upper left, a lighter red lobe and a darker red shade on the lower right. Simple, iconic, instantly readable. One heart, front on, centred.
```

LAYOUT: `One object, centred, nothing else.`

### Health upgrade (heart in a jar)

Reference: `shared/upgrade.png`. 16 x 16, **1 frame**. It looks like treasure.

```
A small round glass jar with a brown cork stopper and a gold band round the neck, containing a glowing red heart. A little glint of light and two or three tiny sparkles above it, so it clearly looks precious. Bold black outline, front on, centred.
```

LAYOUT: `One object, centred, nothing else.`

### Spark (particle)

Reference: `shared/spark.png`. 8 x 8, **1 frame**. **Important:** the game colours this sprite in code with a tint, so it must be **white and light grey only, with no colour at all**. Otherwise the tint comes out muddy.

```
A tiny four-pointed sparkle star, pure white at the centre fading to light grey at the tips, with a thin, crisp shape. No colour, no outline, no glow halo, perfectly symmetric.
```

LAYOUT: `One sparkle, centred on a flat solid #000000 black background.`

For this one asset, use black as the key and drop the colour clause from TECH_SPRITE (a white sparkle fringes badly against magenta). Remove the black with `convert in.png -fuzz 8% -transparent black out.png`.

### Ray icons

Reference: `shared/icons.png`. 24 x 24, **6 icons**, in this order: **blue, red, green, white, UV, dash**. They sit in the colour wheel at the bottom of the HUD and in the pause book, shown small, so keep each shape **bold, simple and unmistakable**. The shape tells the ray apart as much as the colour does.

```
{STYLE_GOLDEN}

Six game icons in a single horizontal row, equally spaced, each in its own equal square cell, each with a bold black outline and a flat bright colour, each readable at a very small size. The shapes are:
1 BLUE ray: a bright blue cone opening to the right, widening from a small point on the left.
2 RED ray: a straight, thin, bright red beam shooting to the right out of a small emitter on the left.
3 GREEN ray: a glowing green charged blob, a round ball of energy with a bright core and a few small drips of light.
4 WHITE ray: a bright white ring bursting outward all round, like a shockwave, with short spikes pointing out.
5 UV ray: a violet glass lens on the left with violet-white light streaming out of it to the right.
6 DASH: three bold chevrons pointing right, leaving three short speed lines behind them, in a pale silver.
```

Use the **lime** key for this sheet, because the violet UV icon fringes against magenta. Then slice it into six 96 x 96 cells.

### Era icons

Reference: `shared/era-icons.png`. 24 x 24, **4 icons**: **Golden Age, Cyberpunk, Retro, Manga**. They appear over the Prism's head before it changes the era, so each must be recognisable **by shape alone**.

```
{STYLE_GOLDEN}

Four game icons in a single horizontal row, equally spaced, each in its own equal square cell, each with a bold black outline, readable at a very small size. Four distinct shapes:
1 GOLDEN AGE: a bright sun, a round yellow disc with a plain calm face and eight triangular rays.
2 CYBERPUNK: a glowing cyan crescent moon rising over a tall dark tower with a few pink and amber lit windows.
3 RETRO: a dull grey old television set with a rounded screen, two knobs and a small antenna, the screen a pale green-grey.
4 MANGA: a white speech balloon with a spiky shout-shaped edge, drawn in black ink on paper, with three short speed lines and a few screentone dots.
```

## Part B. Per-era items

### Projectiles

Reference: `{era}/projectiles.png`. 16 x 16, **4 frames**. Each shows something the enemies throw. These are small and fast, so make them **bold and simple**, with a clear silhouette and a strong outline.

**SUBJECT (goldenAge, cyberpunk, retro, manga):**

```
Four small thrown objects: 1 a lump of grey-brown rock and gunk with a chunky irregular outline. 2 a round white snowball with a few small tufts and a pale blue shadow. 3 a glob of bright green acid, shiny and wet, with a tail of small drips trailing behind. 4 a sharp blue crystal shard, a long diamond-shaped sliver with a bright white highlight on its left edge.
```

**SUBJECT (plain):**

```
Four small everyday objects that have been thrown: 1 a plastic water bottle, half full. 2 a single scoop of pink ice cream, with a little cone-shaped dribble below it. 3 a wet yellow kitchen sponge with a few soap bubbles. 4 a sudden blue camera-flash burst, a star-shaped flare of pale blue light.
```

**LAYOUT:** `Four objects in a single horizontal row, equally spaced, each centred in its own equal square cell, all at the same scale. Same line weight in all four.`

### Hazards (floor decals)

Reference: `{era}/hazards.png`. 32 x 32, **2 frames**. These lie **flat on the floor, seen from above**. They have **no black outline**, only a darker rim, so they sit on the paving.

**SUBJECT (monster eras):**

```
Two flat floor patches seen from directly above, each an irregular rounded blob: 1 a patch of slippery ice, pale blue-white with a few thin white scratch highlights and a darker blue rim. 2 a pool of bubbling acid, bright toxic green with a few small bubbles and a dark green rim. No black outline.
```

**SUBJECT (plain):**

```
Two flat everyday spills seen from directly above, each an irregular rounded blob: 1 a puddle of melted pink-and-cream ice cream with a dropped cone in it and a darker pink rim. 2 a patch of soapy water, pale grey-blue and shiny with a few white soap bubbles and a darker blue-grey rim. No black outline.
```

**LAYOUT:** `Two patches in a single horizontal row, equally spaced, each centred in its own equal square cell, all in the same scale, on a flat solid {KEY} background. Flat and seen straight down, with no perspective and no cast shadow.`

## Part C. Optional extras

Not in the sprite folders, because the game draws them with code. They are the "comic" theme's showpieces if you want to replace them, or use them for the itch.io page.

### Cover art / itch.io banner

The game's cover is titled **LIGHT HANDLER**, with the tagline **"He sees what no one else can!"** The twist is that he is shining a pocket torch at passers-by.

Use **STYLE_GOLDEN**, 16:9, on a real (not flat) background.

```
{STYLE_GOLDEN}

A dramatic Golden Age comic cover illustration. In the foreground a heroic man in a long blue coat, a red scarf, yellow rubber gloves and welder's goggles pushed up on his forehead, striking a bold low pose, aiming a chunky brass-and-steel ray gun with a glowing lens straight at the viewer, a rainbow beam bursting out of it. Behind him, a city square with a fountain, shops and a town hall with a clock, with a swarm of cartoon monsters (a purple bat, a blue slime, a rat, a boulder golem, an armoured knight) leaping at him. A burst of radiating yellow speed lines behind him. Leave the top fifth of the image empty for a masthead and a clear strip along the bottom for a tagline. Do not write any text.
```

Add the title in Photopea, never in the AI image. Image models misspell text.

### Hit-word bursts

The game shows comic words when something is hit: `pow`, `bap`, `zot`, `thwap`, `whap`, `biff`, and bigger ones for weak spots (`KRAKA-ZAP!`, `FZZAAAK!`, `BLAZAM!`, `SKRAZZT!`, `ZZARRK!`, `KA-THOOM!`, `VZZOWW!`). They are text today. If you want drawn versions, **draw the burst shape with the AI and keep the lettering as game text**, because the game needs to vary the words.

```
{STYLE_GOLDEN}

Six empty comic explosion bursts in a 3 by 2 grid, equally spaced, each in its own equal cell on a flat solid {KEY} background. Each is a different spiky starburst shape in bold flat colour with a thick black outline and an offset hard shadow: 1 yellow with a red edge, 2 red with a yellow edge, 3 white with a blue edge, 4 orange, 5 pale blue, 6 pink. The centre of each burst is empty and a flat solid colour, ready for text. Do not draw any text, letters or symbols.
```

### Pause book page

The pause menu is an open comic book. Four spreads: the eras as comic panels, the Field Guide, the machine, settings.

```
{STYLE_GOLDEN}

An open comic book seen from directly above, lying flat on a flat dark background, two facing pages. Aged cream paper with faint halftone dots, a visible centre fold with a soft shadow, slightly curled page corners. The left page and the right page are each empty inside a bold ink border with rounded corners, ready for content. Do not draw any text, panels or pictures inside the borders.
```

## Checklist

| Asset | Frames | One version | goldenAge | cyberpunk | retro | manga | plain |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Heart | 1 | [ ] | | | | | |
| Upgrade jar | 1 | [ ] | | | | | |
| Spark (white only) | 1 | [ ] | | | | | |
| Ray icons | 6 | [ ] | | | | | |
| Era icons | 4 | [ ] | | | | | |
| Projectiles | 4 | | [ ] | [ ] | [ ] | [ ] | [ ] |
| Hazards | 2 | | [ ] | [ ] | [ ] | [ ] | [ ] |
| Cover (optional) | 1 | [ ] | | | | | |
| Hit bursts (optional) | 6 | [ ] | | | | | |
| Pause book (optional) | 1 | [ ] | | | | | |
