# 03. Characters, enemies and the machine

Every prompt here is a **SUBJECT** block. Assemble the full prompt like this (see [01](01-tools-and-workflow.md) for the attachments):

```
{INTRO LINE from file 01, step 3}

{STYLE block for the era, from file 02}

{SUBJECT from this file}

{LAYOUT from this file}

{TECH_SPRITE from file 02, with the key colour filled in}
```

Pixel references are in `art-image/sprites/{era}/{key}.png` (upscale first, per file 01). Replace `{era}` with `goldenAge`, `cyberpunk`, `retro`, `manga` or `plain`.

**How the eras differ for monsters.** Golden Age, Cyberpunk, Retro and Manga all show the **same monster design**, drawn with less detail and colour each time. The style block already carries that. `plain` shows the **ordinary person** the monster really was, so it has its own subject. Never mention the monster in a `plain` prompt, and never mention the person in a monster prompt.

**Facing.** Side-on sprites face **right**. Front-on sprites face the viewer.

## Worked example, fully assembled

The hero in Golden Age, front view, four poses. All other prompts assemble the same way.

```
Image 1 is the style reference: copy its linework, colour treatment and shading, not its subject. Image 2 is a pixel-art layout reference: keep its pose, silhouette, proportions and frame order, but redraw it completely as hand-inked comic art. Do not copy the pixels.

Classic Golden Age American comic book art, 1940s-1950s four-colour printing. Confident black ink outlines with clear thick-and-thin line weight, thickest on the outer silhouette. Flat, bright, saturated colours led by primary red, yellow and blue, with a small sunny highlight and one hard shadow tone per colour. Shading with Ben-Day halftone dots and a few crisp hatching strokes. Slightly rounded, friendly, energetic shapes. Full detail: stitching, folds, small props and expressions are all drawn. Sunny, warm daylight, light from the upper left. Looks like an inked and hand-coloured printed comic panel, not a 3D render, not a photo, not airbrushed.

The Light Handler, a heroic lone defender of a city square. He wears a pair of welder's goggles pushed up on his forehead, a long red scarf, bright yellow rubber washing-up gloves, and a long blue coat that reaches his knees over dark trousers and sturdy brown boots. Tousled brown hair, a determined, slightly wild-eyed look. Seen from the front, standing, arms slightly out from his sides.

Draw four poses in a single horizontal row, equally spaced, each in its own invisible equal-sized cell: 1 idle standing, 2 walking with the left foot forward, 3 walking with the right foot forward, 4 dashing, leaning forward with the coat and scarf streaming back. Same scale and same foot baseline in every pose.

Output a game sprite on a perfectly flat, solid #FF00FF background, with no gradient, no floor, no ground shadow, no vignette and no texture. Draw only the subject. The whole figure is fully visible and never cropped, centred in its cell with equal empty margin on all sides and the feet on the same baseline in every frame. The same character, outfit, proportions, colours and line weight in every frame. Viewpoint: slightly raised, like a top-down adventure game, as in the reference. Crisp clean edges, a clear readable silhouette that still works when shown very small. No text, no watermark, no border, no frame, no labels, no numbers, no extra characters, no scenery.
```

---

## 1. The Light Handler (hero)

Reference: `{era}/player.png`, **16 frames of 32 x 48**. Frame order: **down, up, left, right**, each with *idle, walk A, walk B, dash*. In the game, **left is a mirror of right**, so generate **down, up, right** (12 frames) and flip.

Generate **one row per facing**, so there are three prompts per era. Use the same style anchor and the same first-row result as an extra reference for rows 2 and 3, so the outfit stays identical.

**SUBJECT (goldenAge, cyberpunk, retro, manga):**

```
The Light Handler, a heroic lone defender of a city square. He wears a pair of welder's goggles pushed up on his forehead, a long red scarf, bright yellow rubber washing-up gloves, and a long blue coat that reaches his knees over dark trousers and sturdy brown boots. Tousled brown hair, a determined, slightly wild-eyed look. {FACING}
```

Replace `{FACING}` with one of:

- `Seen from the front, standing, arms slightly out from his sides.`
- `Seen from directly behind, so we see his back, the scarf tails and the back of the coat.`
- `Seen from the side, facing right, leaning slightly forward into a stride.`

**LAYOUT:**

```
Draw four poses in a single horizontal row, equally spaced, each in its own invisible equal-sized cell: 1 idle standing, 2 walking with the left foot forward, 3 walking with the right foot forward, 4 dashing, leaning forward with the coat and scarf streaming back. Same scale and same foot baseline in every pose.
```

**Era notes:**

- Cyberpunk: add `A faint cyan rim light on his left edge and a pink glow on the scarf.`
- Retro: add `Keep only the outline, the red-brown scarf and the goggles readable; the rest is flat tone.`
- Manga: add `The coat is solid black, the scarf is a screentone strip, the face and gloves are left white.`

**SUBJECT (plain):** the same man as he really is.

```
An ordinary man in his thirties, a little tired and a little lost. Messy short brown hair, a plain green jacket over a white shirt, ordinary blue jeans and worn brown shoes. No goggles, no scarf, no gloves, nothing heroic. He walks like someone with nowhere in particular to be. {FACING}
```

Use the same `{FACING}` options and the same LAYOUT. For frame 4, "dashing" becomes `a hurried step, a little faster than walking, nothing athletic`.

---

## 2. The EMW Machine and the pocket torch

Reference: `{era}/machine.png`. **One frame, 24 x 12.** It points **right**, with its origin at the left (grip) end. The game rotates it to aim, so it has **no up or down**: draw it **side-on, perfectly horizontal, top-down symmetric**.

**SUBJECT (goldenAge, cyberpunk, retro, manga):**

```
A hand-held ray gun, the EMW Machine, pointing exactly to the right. A brass grip at the left end, a steel body with a red gemstone set into it, a long barrel, and at the right end a flared dish with a glowing glass lens in the middle. A little chunky and handmade, like a lamp turned into a weapon. Seen perfectly side-on, horizontal, with no perspective.
```

Cyberpunk: add `The lens glows cyan.` Retro: add `The lens is the only pale spot.` Manga: add `The lens is bare white paper.`

**SUBJECT (plain):**

```
An ordinary grey metal pocket torch, pointing exactly to the right, with a ribbed grip at the left end and a round lens at the right with a warm yellow beam just starting to come out. Seen perfectly side-on, horizontal, with no perspective.
```

**LAYOUT:** `One single object, perfectly horizontal, centred, nothing else in the image.`

---

## 3. Rat / pigeon

Reference: `{era}/rat.png`. **2 frames of 16 x 16.** Side-on, facing right. Frame 1 = body stretched out mid-run, frame 2 = body gathered up.

**SUBJECT (monster eras):**

```
A small, fast city rat, side-on and facing right, with a long thin tail, pointed snout, round ears and tiny pink feet. A hint of mischief and menace. Colours in the purple-pink family.
```

**SUBJECT (plain):**

```
An ordinary grey city pigeon, side-on and facing right, walking along the ground, with a small head, a neat orange eye, pink feet and a hint of green-purple sheen on the neck.
```

**LAYOUT:** `Two frames in a single horizontal row. Frame 1: the body stretched long, mid-stride. Frame 2: the body gathered up short, feet under it. Same character in both.`

---

## 4. Slime / small dog on a lead

Reference: `{era}/slime.png`. **2 frames of 32 x 32.** Frame 1 = flat and wide, frame 2 = tall and stretched (a bounce).

**SUBJECT (monster eras):**

```
A friendly-looking blue jelly slime with a glossy white highlight on top, two small dark eyes and a tiny smile, a little puddle of itself spreading under it. Squashy, bouncy and slightly smug.
```

**LAYOUT:** `Two frames in a single horizontal row. Frame 1: squashed flat and wide. Frame 2: stretched tall and narrow. Same slime in both.`

**SUBJECT (plain):**

```
A small white dog with brown patches, side-on and facing right, trotting on a thin red lead that runs from its collar up to the upper left edge of the picture, where its owner would be.
```

**LAYOUT:** `Two frames in a single horizontal row: walking, then a little hop with the ears bouncing. Same dog in both.`

---

## 5. Bat / starling

Reference: `{era}/bat.png`. **2 frames of 24 x 24.** Seen from the front. Frame 1 = wings up, frame 2 = wings down.

**SUBJECT (monster eras):**

```
A purple bat seen from the front with wide spread wings, pointed ears, small glowing eyes and tiny fangs, a fluttery, jittery little pest.
```

**SUBJECT (plain):**

```
An ordinary dark starling in flight seen from the front, with spread wings and a short tail, iridescent black feathers with tiny pale speckles and a yellow beak.
```

**LAYOUT:** `Two frames in a single horizontal row. Frame 1: wings raised high. Frame 2: wings swept low. Same creature in both.`

---

## 6. Ironclad / cyclist

Reference: `{era}/ironclad.png`. **3 frames of 32 x 32.** Frame 1 and 2 = alternating steps, frame 3 = wind-up (raised arm).

**SUBJECT (monster eras):**

```
A small, stout armoured knight seen from the front: a steel helmet with a red plume and a dark visor slit with two glowing eye-lights, a cross on the chest plate, a gold belt buckle and heavy steel boots. Solid, stubborn and slow.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: left boot stepping forward. Frame 2: right boot stepping forward. Frame 3: winding up to attack, one arm raised high holding a small glowing gold mace. Same knight in all three.`

**SUBJECT (plain):**

```
A cyclist in a light blue helmet and a yellow top, riding a red bicycle, side-on and facing right, pedalling steadily.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1 and 2: pedalling, with the legs and wheels in different positions. Frame 3: the cyclist lifts one arm in a friendly wave. Same cyclist and bike in all three.`

---

## 7. Golem / delivery man with a trolley

Reference: `{era}/golem.png`. **4 frames of 48 x 48.** In monster eras the golem is a **rolling boulder**: the four frames are the same boulder turned by quarter turns.

**SUBJECT (monster eras):**

```
A big round boulder golem, a rolling rock with stubby fists sticking out of its sides and two stubby feet, deep cracks across it, patches of green moss, and glowing orange eyes and cracks like embers. Heavy and ominous, with a scowling crack for a mouth.
```

**LAYOUT:** `Four frames in a single horizontal row. The same boulder rolling, turned by about a quarter turn between each frame so the fists and feet appear at different angles around it. Same size and colours in all four.`

**SUBJECT (plain):**

```
A delivery man in a red cap, a yellow shirt and blue jeans, side-on and facing right, pushing a grey two-wheeled hand trolley stacked with three brown cardboard boxes. He looks tired and polite.
```

**LAYOUT:** `Four frames in a single horizontal row of a walking cycle: contact, passing, contact on the other foot, passing. The boxes stay stacked and the same in every frame.`

---

## 8. Zig-zag bat / kid on a scooter

Reference: `{era}/zigbat.png`. **2 frames of 24 x 24.** Fast class: thin and sharp.

**SUBJECT (monster eras):**

```
A small, sharp, red bat seen from the front, with jagged lightning-bolt shaped wing edges, glowing yellow eyes and a lean, angry, hungry look.
```

**LAYOUT:** `Two frames in a single horizontal row. Frame 1: wings spread wide. Frame 2: wings pulled in, mid-dart. Same bat in both.`

**SUBJECT (plain):**

```
A child in a helmet riding a kick scooter, side-on and facing right, one foot on the board and one foot pushing off the ground.
```

**LAYOUT:** `Two frames in a single horizontal row: the pushing leg back, then the pushing leg swung forward. Same child and scooter in both.`

---

## 9. Skitter / jogger

Reference: `{era}/skitter.png`. **2 frames of 32 x 32.** Fast class.

**SUBJECT (monster eras):**

```
A round glowing orange bug body with a grumpy little face, balanced on six very long, thin, jointed spindly legs like a spider crossed with a lantern, with small sparks at its leg tips. Quick and scuttling.
```

**LAYOUT:** `Two frames in a single horizontal row of a scuttle: the legs in one stride in frame 1, and the stride swapped in frame 2. Same creature in both.`

**SUBJECT (plain):**

```
A jogger seen from the front, in a green t-shirt with a small logo, blue shorts, a red headband and white trainers, with a couple of sweat drops flying off, mid-run and a little out of breath.
```

**LAYOUT:** `Two frames in a single horizontal row of a run: left foot down with the right arm forward, then right foot down with the left arm forward. Same jogger in both.`

---

## 10. Ghost / man in a dark coat

Reference: `{era}/ghost.png`. **3 frames of 32 x 32.** Stealth class (the game draws it almost transparent, so the **outline must carry the whole character**). Use the **lime** key.

**SUBJECT (monster eras):**

```
A soft, round, purple ghost shaped like a bedsheet with a wavy hem, two round dark eyes with tiny yellow sparkles, and no mouth until it scares. Wispy and silly-spooky.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: floating still. Frame 2: floating a little lower, hem rippling. Frame 3: arms thrown up, mouth wide open in a round "boo". Same ghost in all three.`

**SUBJECT (plain):**

```
A man in a long dark overcoat and a black bowler hat, seen from the front, with a mild, closed expression, hands at his sides. An ordinary commuter.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: standing. Frame 2: a slight shift of weight. Frame 3: squinting and raising one hand against a glare of light. Same man in all three.`

---

## 11. Wraith / cinema doorman

Reference: `{era}/wraith.png`. **3 frames of 32 x 32.** Stealth class. Use the **lime** key.

**SUBJECT (monster eras):**

```
A sinister hooded wraith in a dark purple cloak with a ragged hem cut into sharp points, a black face inside the hood with glowing red eyes and a row of small white teeth, and thin pale bony hands. The same body shape as a ghost, but sharper and meaner.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: floating still, hands low. Frame 2: hem swaying. Frame 3: both bony hands thrown up, mouth stretched in a grin. Same wraith in all three.`

**SUBJECT (plain):**

```
A cinema doorman seen from the front, in a red uniform jacket with two rows of gold buttons and gold trim, a red pillbox hat, white gloves, and a polite, bored face.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: standing at attention. Frame 2: a slight shift of weight. Frame 3: raising one gloved hand against a glare of light. Same doorman in all three.`

---

## 12. Snowman / ice-cream vendor

Reference: `{era}/snowman.png`. **3 frames of 32 x 32.** Projectile class (throws). Frame 3 = the throw.

**SUBJECT (monster eras):**

```
A stacked snowman of two round snowballs with two coal eyes, a carrot nose, a mean little smile, a red scarf, a yellow cone hat and two thin brown stick arms.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: standing, arms low. Frame 2: a small bob up and down. Frame 3: throwing, one stick arm raised high holding a snowball. Same snowman in all three.`

**SUBJECT (plain):**

```
An ice-cream vendor seen from the front, in a white paper hat, a white shirt with a red-and-white striped apron and grey trousers, holding an ice-cream cone in one hand.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: standing, cone at his side. Frame 2: a small shift of weight. Frame 3: stretching the arm out, offering the cone forward. Same vendor in all three.`

---

## 13. Acid slime / window cleaner

Reference: `{era}/acidSlime.png`. **3 frames of 32 x 32.** Projectile class (spits). Frame 3 = the spit.

**SUBJECT (monster eras):**

```
A heavy lime-green slime blob with a sleepy, grumpy face and half-closed eyes, dripping goo down its sides, small bubbles popping from the top, and a thick puddle underneath.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: sitting heavy. Frame 2: sagging slightly lower. Frame 3: swelling up taller with the mouth round and open, blushing, ready to spit. Same slime in all three.`

**SUBJECT (plain):**

```
A window cleaner seen from the front, in a blue cap, blue overalls over a grey shirt, holding a long squeegee in one hand and a small bucket in the other, with a patient, weathered face.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: standing with the squeegee and the bucket. Frame 2: a small shift of weight. Frame 3: swinging the bucket out and flicking soapy water from it. Same man in all three.`

---

## 14. The Prism / police car (boss)

Reference: `{era}/prism.png`. **3 frames of 64 x 64.** The boss, and the biggest sprite in the game. In the monster eras it is a crystal with a face; in `plain` it is the police car whose front the crystal's face was copied from (two roof lights = two roof lights, headlights = eyes, grille = mouth). Keep that face layout.

**SUBJECT (monster eras):**

```
A huge floating blue crystal prism, a faceted gem shaped like a rounded diamond, with an angry, toothy face: two glowing yellow slanted eyes, a wide jagged grin with rows of small white teeth. Two smaller crystals on top like horns, one red and one blue, glowing like siren lights. A few smaller crystal shards hang in the air at each side. Menacing and shiny, with bright white highlights on the facets and the left side lit.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: the red crystal on top glows bright, the blue one is dim. Frame 2: the blue one glows bright, the red one dim. Frame 3: charging an attack, both lit, the side shards lifted high, the mouth open with a bright yellow glow inside. Same prism in all three.`

**SUBJECT (plain):**

```
A police car seen from the front, white with a yellow-and-blue chequered band across the bonnet, a red light and a blue light on the roof bar, a dark windscreen with two police officers' silhouettes inside, a number plate and two round headlights. Parked and ordinary.
```

**LAYOUT:** `Three frames in a single horizontal row. Frame 1: the red roof light on. Frame 2: the blue roof light on. Frame 3: both lights on and the driver's door swung open. Same car in all three.`

---

## Checklist

| # | Asset | Frames | goldenAge | cyberpunk | retro | manga | plain |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero (3 rows) | 12 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 2 | Machine / torch | 1 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 3 | Rat / pigeon | 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 4 | Slime / dog | 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 5 | Bat / starling | 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 6 | Ironclad / cyclist | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 7 | Golem / courier | 4 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 8 | Zig-zag bat / scooter kid | 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 9 | Skitter / jogger | 2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 10 | Ghost / man in dark coat | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 11 | Wraith / doorman | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 12 | Snowman / ice-cream vendor | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 13 | Acid slime / window cleaner | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |
| 14 | Prism / police car | 3 | [ ] | [ ] | [ ] | [ ] | [ ] |

Some monsters only appear in some eras in the game (see `docs/DESIGN.md`: for example the snowman and the acid slime only in Manga, the ghost and the wraith only in Retro). The game still bakes all five styles of every sprite, so generate all of them if you want a complete set. If you only want what is seen in play, do the era each monster appears in, plus `plain`.
