# 04. Backgrounds: the city square

The game has **one background**, drawn five ways: `city-{era}.png`, `city-{era}-over.png` and `crack-{era}.png` for each of the five styles. All are in `art-image/city/{era}/`.

The most important rule: **the layout cannot change.** Walls, street openings, the fountain and the lamp posts are collision tiles from `src/config/square.ts`. If the comic version moves a building, players will walk through walls and bump into thin air. Every prompt attaches the pixel version as a layout guide and says so.

## The layout

The picture is **20 x 10 tiles** (640 x 320 pixels, a 2:1 picture). Top is north.

```
####################   north building fronts, 2 tiles deep
####################   (town hall with clock in the middle, shops either side)
#........ee........#   <- north street opens here, above the two middle tiles
#..o............o..#   lamp post + planter at each o
#e.....,....,.....e#   <- west and east side streets open at these rows
#e.......FF.......e#
#......,.FF.,......#   F = round stone fountain, 2x2 tiles, dead centre
#..o............o..#
#........eP........#   <- south street opens here
####################   south: roofs and awnings seen from behind, 1 tile deep
```

| Side | What stands there |
| --- | --- |
| North (2 tiles deep, seen face on) | Left to right: grocer ("FRUIT"), tailor, **town hall with a clock** (centre, with the street running through), clockmaker ("CLOCKS"), tea shop ("TEAS") |
| West (1 tile) | Roof edges of a bookshop and apartment flats; a side street opens in the middle |
| East (1 tile) | Roof edges of a cinema and a pharmacy; a side street opens in the middle |
| South (1 tile) | Roofs and awnings of a cafe and a bakery, seen from behind; a street opens in the middle |
| Centre | Round stone fountain with a jet of water, on a 2 x 2 tile block |
| Corners of the paving | Four lamp posts, each with a planter at its foot |
| Paving | Worn patches scattered, no pattern |

The building colours in the pixel art (keep them across eras, only the lighting changes):

| Building | Wall | Awning / roof |
| --- | --- | --- |
| Grocer | cream yellow | green awning, terracotta roof |
| Tailor | warm orange | red awning, slate-blue roof |
| Town hall | stone grey-beige | red and yellow awning, blue-grey roof, clock |
| Clockmaker | pale sky blue | amber awning, rust roof |
| Tea shop | golden yellow | purple awning, violet roof |
| Bookshop | tan | blue awning, rust roof |
| Cinema | dusty pink | red and gold awning, plum roof |
| Pharmacy | pale mint | green awning, teal roof |
| Cafe | cream | red awning, terracotta roof |
| Bakery | golden yellow | amber awning, orange roof |

## Step 1: letterbox the reference to 16:9

Image models rarely output 2:1. Pad the reference to 16:9 with grey bars, generate, then crop the middle back to 2:1.

```bash
cd /home/harshyy/Desktop/GameJam/unity-particle-system
mkdir -p art-image-ref
for s in goldenAge cyberpunk retro manga plain; do
  convert art-image/city/$s/city.png -filter point -resize 300% \
    -background '#808080' -gravity center -extent 1920x1080 \
    art-image-ref/city_${s}_16x9.png
done
```

(640 x 320 at 300% is 1920 x 960. The extent adds 60 grey pixels top and bottom to make 1920 x 1080.)

## Step 2: generate the base picture

Attach: **Image 1** = the era's style anchor (the town hall anchor from file 01), **Image 2** = `art-image-ref/city_{era}_16x9.png`.

Start every prompt with:

> Image 1 is the style reference: copy its linework, colour treatment and shading, not its subject. Image 2 is the layout: a pixel-art top-down view of a city square inside grey bars. Redraw the artwork inside the grey bars completely as hand-inked comic art, keeping every building, doorway, street opening, lamp post, planter and the fountain in exactly the same position and size. Keep the top and bottom grey bars as plain flat grey. Do not copy the pixels.

Then paste the era's prompt below, and finish with `TECH_BACKGROUND` from file 02.

The picture is seen **from above at a steep angle**: the paving is a flat plane, the north buildings are seen face on and the other three sides show roofs and awnings from behind and above.

### Golden Age

```
{STYLE_GOLDEN}

The city square on a bright sunny morning. Warm cream flagstone paving with a few darker worn patches. A round stone fountain in the middle with a bright, sparkling jet of water and a ring of splashed droplets. Four iron lamp posts with planters of red, yellow, pink and white flowers at their feet. Cheerful buildings all round with striped awnings, flower boxes, painted shop signs reading FRUIT, TAILOR, CLOCKS and TEAS, and a stately town hall with a clock in the centre of the north side. Warm sun from the upper left, crisp hard shadows falling to the lower right, a bright blue sky reflected in the windows. Every detail is drawn: roof tiles, brickwork, shutters, window panes, cobble joints, leaves.
```

### Cyberpunk

```
{STYLE_CYBER}

The same city square at dusk. Cool indigo-violet paving with glistening wet reflections and puddles of coloured light. A round stone fountain in the middle lit from within in cyan. Four lamp posts with neon heads, alternately cyan and hot pink, each throwing a soft pool of light on the paving and a planter at its foot. The same buildings, now with lit windows in pink, cyan and amber, glowing neon signs reading FRUIT, TAILOR, CLOCKS and TEAS, and the town hall clock face glowing cyan. Deep violet shadows, hard cross-hatching in the shade. Fewer small details than in daylight: shutters, flower boxes and brick texture are simplified into bold shapes.
```

### Retro

```
{STYLE_RETRO}

The same city square, dark and dull. Everything is drawn in five tones of grey-green plus a little rust. Dark olive paving with slightly lighter worn patches. The fountain a simple round shape with no water jet detail. Four lamp posts with plain planters. The same buildings as simple blocky shapes: flat walls, plain windows with dark panes, a single flat awning shape on each, signs as plain blocks with no readable lettering, the town hall clock as a pale circle. Almost no texture and no highlights. A flat, tired, washed-out mood.
```

### Manga

```
{STYLE_MANGA}

The same city square as a black-and-white manga ink drawing. Paving as white paper with a sparse screentone dot pattern for the shaded areas and a few worn patches in grey tone. A round fountain outlined with bold brush line and a few speed-line splashes. Four lamp posts as solid black silhouettes with bare white lamp heads. The same buildings as bold ink shapes: solid black windows and doorways, awnings alternating white and screentone, roofs as solid black or heavy screentone, signs as clear black rectangles. Strong contrast, huge areas of white and black, very little small detail.
```

### Plain (the ending: an ordinary day)

```
{STYLE_PLAIN}

The same city square on an ordinary overcast afternoon. Faded grey-beige paving with cracked and mended patches, a dropped crisp packet and a few worn spots. The round stone fountain with a gentle small jet and a pigeon-stained rim. Four ordinary lamp posts with tidy planters of modest flowers. The same buildings but real and slightly shabby: faded awnings, flower boxes with a few weeds, small hand-painted shop signs reading FRUIT, TAILOR, CLOCKS and TEAS, a tired but dignified town hall with a clock that is slightly wrong. Soft, even light, soft grey shadows, no glow, no neon, nothing heroic. Full detail of everyday life: bicycle racks, drainpipes, a bin, a "no ball games" sign, window curtains.
```

## Step 3: check the alignment (important)

Overlay the result on the pixel version at 50% and look for anything that moved.

```bash
cd /home/harshyy/Desktop/GameJam/unity-particle-system
mkdir -p art-image-comic/city/goldenAge
# 1. Crop the 2:1 centre out of the 16:9 result (here for a 1920x1080 result; adjust the numbers)
convert result.png -gravity center -crop 1920x960+0+0 +repage -resize 2560x1280! \
  art-image-comic/city/goldenAge/city.png
# 2. Blend with the pixel version (upscaled to the same size)
convert art-image/city/goldenAge/city.png -filter point -resize 400% /tmp/pix.png
composite -blend 50 art-image-comic/city/goldenAge/city.png /tmp/pix.png /tmp/check.png
```

Open `/tmp/check.png`. The fountain, the four lamp posts, the north buildings and all four street openings should sit on top of each other. If they don't:

1. Say so in a new message with the result attached: *"The fountain is too far left and the town hall is too wide. Keep everything exactly as it is, but move the fountain to the exact centre and make the town hall the same width as in Image 2."*
2. If it keeps failing, try the **trace first** method: ask for *"clean black ink line art only, white background, no colour, same layout"*, check the alignment, and only then ask for *"now colour this line art in the style of Image 1, without changing any line"*.

## Step 4: the "over" layer

`city-{era}-over.png` holds the parts drawn **in front of the characters**: lamp heads, awnings, and the upper part of the fountain jet. It is transparent everywhere else. Do **not** ask the AI for it. Cut it out of the new base using the pixel version's over layer as a mask. The shapes then match exactly.

```bash
cd /home/harshyy/Desktop/GameJam/unity-particle-system
E=goldenAge   # repeat for each era
# Mask = alpha of the pixel over layer, enlarged to match the comic image
convert art-image/city/$E/city-over.png -alpha extract -filter point -resize 400% \
  -morphology Dilate Diamond:2 -blur 0x1 /tmp/over_mask.png
# Copy the matching region out of the comic base
convert art-image-comic/city/$E/city.png /tmp/over_mask.png \
  -alpha off -compose CopyOpacity -composite art-image-comic/city/$E/city-over.png
```

The dilate and blur grow the mask by a couple of pixels so the comic outlines are not clipped. Check the result over the base. If a lamp head is cut off, increase `Diamond:2` to `Diamond:4`.

## Step 5: the cracked wall (secrets)

`crack-{era}.png` is **2 frames of 32 x 32**: a hairline crack that marks the secret wall in each era, then the broken wall. It is drawn **on top of a building wall**, so it needs transparency. Use the **lime** key for Cyberpunk and **magenta** for the others.

```
{STYLE for the era}

Two small square wall-decal images side by side on a flat {KEY} background. Both show a section of building wall viewed face on, exactly square. Left: an intact wall with a single thin, hairline crack running across it, almost invisible, drawn with a fine ink line. Right: the same wall section broken open, a jagged hole with loose bricks and stones falling and dust, the hole dark inside. Same bricks, same wall colour, same lighting in both.

Output as two equal square cells in one horizontal row, with the same scale and nothing outside the cells. No text.
```

Era colour for the wall section: Golden Age warm cream plaster, Cyberpunk indigo plaster with a cyan edge light, Retro olive plaster, Manga white wall with screentone and an ink crack, Plain faded grey plaster.

## Checklist

| Era | `city.png` | alignment checked | `city-over.png` | `crack.png` |
| --- | --- | --- | --- | --- |
| goldenAge | [ ] | [ ] | [ ] | [ ] |
| cyberpunk | [ ] | [ ] | [ ] | [ ] |
| retro | [ ] | [ ] | [ ] | [ ] |
| manga | [ ] | [ ] | [ ] | [ ] |
| plain | [ ] | [ ] | [ ] | [ ] |

## If one full-picture generation keeps failing

Draw the square in **pieces** instead, then assemble them in Photopea or Krita: the north row (2 tiles deep), the west strip, the east strip, the south strip, and the central paving with the fountain. Each piece has a simple layout the AI follows well. Use the same style anchor for all of them and re-apply the era's colour grade at the end so the seams disappear.
