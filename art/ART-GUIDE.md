# Art guide

How the map and building art has to be made so it fits together. Keep
every new piece of art to these rules; that is what lets a building
generated months later sit on a map made today.

## Camera (every image: maps, buildings, cargo pod)

- **True 2:1 isometric (dimetric), orthographic.** No perspective:
  parallel edges stay parallel, far things are not smaller.
- Ground edges slope at **26.57°** from horizontal: **1 pixel up for every
  2 pixels across**. A square on the ground is drawn as a diamond exactly
  twice as wide as it is tall.
- In 3D terms: camera **30° above the ground**, turned **45°** around the
  vertical, so the viewer looks at the front corner of a square.
- Directions used below: the **back corner** is at the top of the image,
  the **front corner** at the bottom, the left and right corners at the
  sides.

**What the maps actually came out at, and what new art should match.**
Image tools rarely hit an exact angle. The second-generation maps (Sep
2026) came out symmetric and identical to each other, but about 2°
steeper than true 2:1, and they are now the reference: new art should
match them, not the textbook figure.

| Art | Left edge | Right edge | Top-face diamond, height ÷ width |
|---|---|---|---|
| Moon map v1 | 26.0° | 24.1° | 0.47 |
| Mars map v1 | 23.5° | 25.1° | 0.45 |
| Moon and Mars maps v2 (current) | 28.5° | 28.5° | 0.54 |
| Cargo landing pad (Sep 2026) | 29.1° | 29.2° | 0.56 |
| Buildings v1: habitat, reactor, solar | 27.6°, 27.7°, 26.2° | 23.7°, 27.6°, 17.3° | |
| Buildings v1: greenhouse, lab, O₂ plant | 33.2°, 19.3°, 24.0° | 26.2°, 19.8°, 31.8° | |
| True 2:1 | 26.57° | 26.57° | 0.50 |

So for anything new, ask for **2:1 isometric** and check the result
against the maps: edges between about 26° and 29° sit well on them.
Measured by fitting lines to the silhouette edges, ignoring the rocks.

The cargo pad came out within a degree of the maps, which the first
buildings never did, so **the pad image is the reference for every new
building**: each building prompt below starts from it (see Buildings).

## Lighting (every image)

- Sun from the **upper left**. Left-facing walls and the slab's left cliff
  face are lit; right-facing walls and the right cliff face are in shade.
  Short shadows fall to the **lower right**.
- The Moon art built on the cargo pad came out a warm tan, on a cool grey
  map, so the game cools its day images slightly (`MOON_LIGHT` in
  `src/ui/BaseView.tsx`, measured from both). Night images are left as
  they are: they are lamp-lit, and lamplight is warm.
- Each world's buildings are painted in **that world's light**, the same
  light its map is painted in: harsh, clear light with crisp shadows on
  the Moon; warm light with Mars's butterscotch cast and softer shadows on
  Mars. (The first buildings were painted once in Moon light, and the
  game tinted them for Mars with `MARS_LIGHT` in `src/ui/BaseView.tsx`.
  Mars buildings made from these rules do not need the tint.)
- No night versions of the maps are needed. The game darkens the ground
  itself. Moon buildings do need a night version (below). **Mars has no
  night in the game** (its daylight is averaged over the sol), so Mars
  buildings are day only.

## Style (every image)

Stylized 3D render of a game asset: a clean diorama look, soft ambient
occlusion, gentle bevels, no outlines. The cargo landing pad
(`art/source/buildings/lander-pad.png`) is the reference. The first
building sheets (`buildings-day.png`, `buildings-night.png`) are kept
until the new buildings replace them.

## Background (every image)

- **Transparent**, if the tool offers it.
- Otherwise **one flat solid colour, #0C1633** (the game's sky navy), with
  no gradient, vignette, floor shadow or glow. `art/process.py` removes the
  background by flooding in from the image border, so it has to be flat.
  Using the game's own sky colour means any fringe left behind is
  invisible in the game.

## The maps

- **Landscape 3:2**, e.g. 1536 × 1024 (the current maps' size). The code
  is re-measured for new art, so the exact size can change, but **both
  maps must be the same size, with the slab in the same place**.
- One square slab of ground, seen as a diamond:
  - it fills the width of the frame, with a small margin on each side;
  - its back corner is near the top; its front corner, plus the cliff
    below it, near the bottom;
  - the slab is a thick block: flat top, rocky cliff sides on the two
    front faces, **the same thickness on both worlds** (about 1/15 of the
    slab's width).
- **Clear middle.** Buildings stand anywhere from 22% to 78% of the way
  across the slab in both directions, and their platforms reach about 10%
  further. So the **middle four-fifths of the top must be flat, open
  ground**: no rocks, craters or bumps. Rocks, boulders and craters go
  only in a narrow band along the edges and in the corners.
- No grid lines, buildings, vehicles, people, text or stars.
- **Make the Moon first, then make Mars from it.** Give the finished Moon
  image to the generator as a reference, and ask for the same camera,
  framing, slab size, thickness and rock layout, repainted as Mars. This
  is the surest way to get two slabs of the same shape.

## Buildings

- **One building per image**, square, built on a copy of the cargo
  landing pad (`buildings/lander-pad.png`): the same stone platform, the
  same size and place in the frame, the same corner lamp posts, with the
  landing circle and scorch mark taken off. Every building then has the
  same camera, the same scale and the same platform, and the game places
  them all the same way.
- Bold, simple shapes. A building is drawn about 250 pixels wide in the
  game, often less on a phone, so fine clutter turns to noise.
- Doors and entrances face the **lower right** (the front-right face).
- Each building keeps its colour on both worlds, so players can tell
  them apart at a glance: a white habitat, an orange reactor, blue solar
  panels, a green greenhouse, a blue lab, a white-and-blue O₂ plant.
- **Moon: day and night pairs.** The night image is the same picture with
  the lights on, made from the day image as a reference so nothing moves.
  The game cross-fades between them.
- **Mars: the same buildings, repainted.** Each Mars image is made from
  its Moon day image as a reference: same building, same place, in Mars
  light and Mars dust. So the Moon set comes first.
- The reactor is Moon-only (Mars runs on solar). The O₂ plant is
  Mars-only (it stands on the pad Mars leaves empty).

### Stages

Two buildings change with the game.

**The solar field grows as it is built.** There are three images, and
more panel rows stand as the array nears its largest size (the world's
`maxSolarArrayM2`):

| Stage | Panels (Moon art) | Shown when the array is | Moon | Mars |
|---|---|---|---|---|
| 1 | 2, the rest bare footings | under 60% of its largest | 140–160 m² (the start) | 560–700 m² (the start) |
| 2 | 5 | 60–85% | 180–240 m² | 720–1000 m² |
| 3 | 9 | 85% or more | 260–300 m² | 1020–1200 m² |

(The generator read "rows" as the diagonal rows of the diamond, back
corner first, which reads just as well.)

**The habitat shows the base's condition.** There are three images:

| Stage | Shown when condition is | Looks |
|---|---|---|
| good | 85% or more | clean, green light by the door |
| worn | 60–85% | dusty, scuffed, taped, amber light |
| damaged | under 60% (when the map's label turns amber) | caked in dust, a loose panel, a leaking seal, red light |

The Moon starts at 50% (the damaged habitat, which is the briefing's
problem) and Mars at 85% (good). The rows and percentages are display
choices in `BaseView.tsx`, not game rules.

### The set, and file names

Put them in `art/source/buildings/moon/` and `art/source/buildings/mars/`
under these names; `art/process.py` will read them from there.

| Building | Moon, day and night (`-day.png`, `-night.png`) | Mars, day only |
|---|---|---|
| Habitat | `habitat-good`, `habitat-worn`, `habitat-damaged` | `habitat-good.png`, `habitat-worn.png`, `habitat-damaged.png` |
| Solar | `solar-1`, `solar-2`, `solar-3` | `solar-1.png`, `solar-2.png`, `solar-3.png` |
| Reactor | `reactor` | none |
| Greenhouse | `greenhouse` | `greenhouse.png` |
| Lab | `lab` | `lab.png` |
| O₂ plant | none | `o2-plant.png` |

That is 18 Moon images and 9 Mars images, plus the lander's two night
images.

### The order to make them in

Each image is made from an earlier one, so that nothing drifts:

1. **Moon habitat, good, day**, from the landing pad. Stop here and have
   it checked in the game (the angle is measured, and it is tried on the
   map) before making the rest.
2. The other Moon day images: reactor, greenhouse, lab and full solar
   field from the landing pad; worn habitat from the good one, damaged
   from the worn one; solar stage 2 from stage 3, stage 1 from stage 2.
3. Every Moon night image, each from its own day image. (The night image
   for a stage comes from that stage's day image, not from another
   night image, because the game cross-fades each stage between its own
   day and night.)
4. Every Mars image from its Moon day image. The O₂ plant from the Mars
   good habitat.

## Cargo pod

The Moon's cargo lander (Mars has no resupply, so it is Moon-only). It
follows the camera, lighting, style and background rules above: its own
square stone landing pad, the size of one building platform, with a day
and a night image. Modelled on real robotic Moon landers such as NASA's
commercial CLPS landers: four legs, gold-foil insulation, an engine bell
underneath, cargo on the deck. Prompts are below, with the maps'.

In the game it is two layers, so the lander can come down onto the pad:
`buildings/lander-pad.png` (the empty pad) and `buildings/lander-pod.png`
(the lander alone). They were generated at different sizes, so
`art/process.py` scales and moves the lander onto the pad (its three
visible footpads onto where they stood in the first combined render) and
cuts both to one shared box. A regenerated lander needs those two
numbers (`LANDER_SCALE`, `LANDER_OFFSET`) measured again, or, better,
generate it at exactly the pad image's framing.

No night versions yet: at night the game dims both with the same tint as
the ground (`night-dim` in `src/ui/BaseView.tsx`). Night versions would be
the pad with its lamps lit, and the lander with its navigation lights on,
each made from its day image.

## Current maps (v2)

- 1536 × 1024. Top-face corners, in image pixels: Moon back (764, 31),
  left (37, 426), right (1495, 429); Mars back (761, 29), left (34, 425),
  right (1496, 427). Front corner about (768, 824); cliff bottom about
  y 970, so the cliff is about 146 px, a tenth of the slab's width.
- Background #0B1534-ish navy, cut out by `art/process.py`.

## After new art arrives

1. Put the files in `art/source/` under the same names
   (`terrain/moon-terrain.png`, `terrain/mars-terrain.png`, ...).
2. Run `python3 art/process.py` (needs Pillow).
3. Re-measure each slab's corners (`TERRAIN` in `src/ui/BaseView.tsx`),
   and the scene crop (`VIEW`) and building anchors (`SPRITES`) if the
   framing or building art changed.

For the second building set, `process.py` prints each building's size and
anchor for `MOON_SET` in `BaseView.tsx`. It also moves any render whose
platform came out higher or lower than the pad's back into place (the
first solar stages came out 31px high), and prints when it does.

## Prompts

### Moon map

```
Isometric game map tile: one square slab of lunar ground, seen from a true
2:1 isometric (dimetric) camera: orthographic, no perspective, camera 30
degrees above the ground and turned 45 degrees, so the slab is a
symmetrical diamond whose edges slope at 26.6 degrees (one pixel up for
every two across). Landscape 3:2. The diamond fills the width of the frame
with a small margin at each side; its back corner is near the top and its
front corner near the bottom.

The slab is a thick block of rock: a flat top, and rough rocky cliff sides
on the two front faces, about one fifteenth of the slab's width tall.

Top surface: grey lunar regolith with a slight cool blue cast, fine dusty
texture with soft, subtle variation. The middle four-fifths of the surface
is completely flat, smooth, open ground, with no rocks, boulders, craters
or bumps: buildings will be placed there later. Rocks, boulder clusters
and a few small craters appear only in a narrow band along the outer edges
and in the corners.

Lighting: harsh, clear sunlight from the upper left, as on the airless
Moon. The left cliff face is lit, the right cliff face is in shadow, short
crisp shadows fall to the lower right, no haze.

Style: stylized 3D render of a game asset, clean diorama look, soft
ambient occlusion, gentle bevels. No grid lines, no buildings, no
vehicles, no people, no text, no stars.

Background: a single flat solid colour, #0C1633 dark navy, filling the
whole frame. No gradient, no vignette, no glow, no shadow on the
background.
```

### Mars map (with the Moon image attached as the reference)

```
Use the attached image as the exact reference for the camera angle,
framing, slab size, slab thickness, and where the rocks sit. Keep all of
those identical, and repaint the slab as Mars.

Top surface: rusty orange-red Martian soil, fine dust with soft ripples
and slightly darker patches. As in the reference, the middle four-fifths
of the surface is completely flat, smooth, open ground, with no rocks,
craters or bumps. Only the narrow band along the outer edges and the
corners has rocks: darker reddish-brown and basalt-grey boulders, and a
few small shallow craters.

Cliff sides: layered red-brown sedimentary rock, same thickness as the
reference.

Lighting: warm sunlight from the upper left, with the soft butterscotch
cast of Mars's dusty air: the left cliff face lit, the right in shade,
soft shadows to the lower right.

Style: stylized 3D render of a game asset, clean diorama look, soft
ambient occlusion, gentle bevels, matching the reference exactly. No grid
lines, no buildings, no vehicles, no people, no text, no stars.

Background: a single flat solid colour, #0C1633 dark navy, filling the
whole frame. No gradient, no vignette, no glow, no shadow on the
background.
```

If the tool cannot take a reference image, use the Moon prompt with its
surface, cliff and lighting paragraphs swapped for the Mars ones above.

### Cargo lander, day

```
Isometric game asset: a small robotic cargo lander that has just landed on
the Moon, standing on its own square landing pad. Seen from a 2:1
isometric (dimetric) camera: orthographic, no perspective, camera 30
degrees above the ground and turned 45 degrees, so the square pad is a
diamond twice as wide as it is tall. Square image, the lander and pad
centred with a small margin all round.

The lander: a squat octagonal body about as tall as it is wide, wrapped
in crinkled gold and silver foil insulation, on four splayed landing legs
with round footpads. A rocket engine bell shows under the body. On the
top deck, a few grey cargo containers and a supply pallet are strapped
down; a small solar panel and a short antenna stick up from one side. The
cargo hatch and a small loading ramp face the lower right. Clean, new,
with a little dust on the footpads.

The pad: a square platform of grey stone tiles, like a small spaceport
pad, with a painted landing circle, a dark scorch mark under the engine,
and small lamp posts at the four corners. The pad's edges line up with
the isometric grid.

Lighting: harsh, clear sunlight from the upper left, as on the airless
Moon. Left-facing surfaces lit, right-facing surfaces in shade, short
crisp shadows falling to the lower right on the pad.

Style: stylized 3D render of a game asset, clean diorama look, soft
ambient occlusion, gentle bevels, matching a set of sci-fi base buildings
rendered the same way. No ground beyond the pad, no people, no text, no
logos, no stars.

Background: a single flat solid colour, #0C1633 dark navy, filling the
whole frame. No gradient, no vignette, no glow, no shadow on the
background.
```

### Cargo lander, night (with the day image attached as the reference)

```
Use the attached image as the exact reference: the same lander, pad,
camera, framing and size, with nothing moved. Make it night on the Moon:
the sunlight is gone, the lander and pad are lit only by their own
lights. The four corner lamp posts glow warm white and throw soft pools of
light on the pad; small navigation lights on the lander blink red and
green; the loading ramp has a warm light over it. The gold foil catches
the lamp light. Everything else falls into cool dark shade.

Same style as the reference. Background: a single flat solid colour,
#0C1633 dark navy, filling the whole frame. No gradient, no glow on the
background.
```

## Building prompts

Every building prompt names what to attach. "The landing pad" is
`art/source/buildings/lander-pad.png`.

### Moon, day

The first four are made from the landing pad and share one prompt: paste
the building's own paragraph into it where it says so.

```
Use the attached image as the exact reference for the camera angle, the
framing, the stone platform (its size, its place in the frame, its tiles,
edge trim and four corner lamp posts), the lighting and the render style.
Keep all of those identical. Take away the painted landing circle and the
scorch mark, so the platform is plain tiles, and stand this building on
it:

[THE BUILDING'S PARAGRAPH]

The building stands in the middle of the platform with a walkway of tiles
around it, and nothing hangs over the platform's edges. Its entrance
faces the lower right. Bold, simple shapes that stay readable when the
image is shown about 250 pixels wide: no fine clutter.

Daytime on the Moon: harsh sunlight from the upper left with no haze,
left-facing walls lit, right-facing walls in shade, short crisp shadows
falling to the lower right. Windows are dark glass, with at most a faint
warm light inside. A little grey lunar dust on the lowest parts of the
walls.

No ground beyond the platform, no people, no vehicles, no text, no logos,
no stars. Background: a single flat solid colour, #0C1633 dark navy,
filling the whole frame. No gradient, no vignette, no glow, no shadow on
the background.
```

**Habitat, good** (`moon/habitat-good-day.png`). Make this one first and
have it checked in the game before the rest.

```
The crew habitat, the biggest building in the base: a large white dome
of bolted panels with a glass skylight at its top, two short white
cylinder modules joined to its sides, and an airlock with a sturdy door
on the lower-right face. A short antenna mast on one module. Clean, well
kept, bright white, with a small green status light beside the door. It
covers about three quarters of the platform.
```

**Reactor** (`moon/reactor-day.png`)

```
A compact nuclear power unit, modelled on NASA's Kilopower and Fission
Surface Power designs: a short steel reactor cylinder at the bottom, and
above it a tall cone of dark grey radiator fins, like a folded umbrella
standing upright, that sheds the reactor's heat. It sits in a round pit
ringed by a low wall of piled grey regolith bags for radiation
shielding. Beside it, an orange control box with a yellow-and-black
radiation symbol, orange safety railings, and a thick power cable
running off the platform's front-right edge. It covers about half the
platform.
```

**Greenhouse** (`moon/greenhouse-day.png`)

```
The greenhouse, modelled on the University of Arizona's Lunar Greenhouse
prototype: a long, round-topped inflatable tunnel of clear panels held by
thin white ribs, with rows of leafy green plants in hydroponic trays
inside. A white service module at one end. The tunnel's long side runs
parallel to the platform's front-right edge, with an airlock door in the
middle of that side. It covers most of the platform's length.
```

**Lab** (`moon/lab-day.png`)

```
The science lab: a squat, sturdy blue module with a sloped roof and a row
of windows, a sample airlock with a small glovebox window beside the
door on the lower-right face, a few grey sample cases stacked by the
wall, and a white dish antenna on the roof. It covers about two thirds of
the platform.
```

**Solar field, stage 3 (full)** (`moon/solar-3-day.png`)

```
The solar field: three rows of solar panels, three panels in each row,
nine in all. Blue cells in thin silver frames, each panel tilted towards
the upper left, where the sun is, on short grey posts. The rows run from
the lower left to the upper right, with a walkway of tiles between them.
A small grey power box and a cable conduit at the platform's front-right
corner. The panels fill most of the platform.
```

The rest are made from a Moon day image, and their prompts are complete
as they stand.

**Habitat, worn** (`moon/habitat-worn-day.png`). Attach
`moon/habitat-good-day.png`.

```
Use the attached image as the exact reference: the same building,
platform, camera, framing, lighting and size, with nothing moved or
redesigned. Show the same habitat after weeks without repairs: grey lunar
dust coating the lower third of the walls and the door, dust smeared
across the windows, the white panels scuffed and dulled, and a strip of
silver repair tape across one panel seam. The status light beside the
door is amber. Make the wear bold enough to see when the image is shown
small.

Same style as the reference. Background: a single flat solid colour,
#0C1633 dark navy, filling the whole frame. No gradient, no glow, no
shadow on the background.
```

**Habitat, damaged** (`moon/habitat-damaged-day.png`). Attach
`moon/habitat-worn-day.png`.

```
Use the attached image as the exact reference: the same building,
platform, camera, framing, lighting and size, with nothing moved or
redesigned, and every sign of wear it already has kept in place. Show it
run down much further, its systems failing: thick grey dust over most of
the walls and the platform around it, one outer panel hanging loose and
showing dark insulation beneath, two dented panels patched with tape,
and a small white plume of escaping air freezing into glittering frost at
a split seal. The status light beside the door is red. Worn out, not
wrecked: the building is whole, with no fire, no smoke and no holes.
Make the damage bold enough to see when the image is shown small.

Same style as the reference. Background: a single flat solid colour,
#0C1633 dark navy, filling the whole frame. No gradient, no glow, no
shadow on the background.
```

**Solar field, stage 2** (`moon/solar-2-day.png`). Attach
`moon/solar-3-day.png`.

```
Use the attached image as the exact reference: the same platform, camera,
framing, lighting and size, with nothing moved. Take away the front row
of panels (the row nearest the bottom of the image), leaving the two back
rows exactly as they are. Where the front row stood, its row of small
concrete footings stays on the tiles, waiting for panels to be built.

Same style as the reference. Background: a single flat solid colour,
#0C1633 dark navy, filling the whole frame. No gradient, no glow, no
shadow on the background.
```

**Solar field, stage 1** (`moon/solar-1-day.png`). Attach
`moon/solar-2-day.png`, and use the stage 2 prompt with its second
paragraph's first two sentences changed to: "Take away the front row of
panels (the row nearest the bottom of the image), leaving only the back
row exactly as it is. The front row's footings stay as they are."

### Moon, night

One prompt for every Moon night image: attach the day image with the
same name (for example `moon/lab-day.png` for `moon/lab-night.png`), and
paste that building's line from the list below into the prompt.

```
Use the attached image as the exact reference: the same building,
platform, camera, framing and size, with nothing moved and every detail
kept. Make it night on the Moon: the sunlight is gone, and with no air
there is no glow in the sky, so the scene is lit only by its own lights.
The four corner lamp posts glow warm white and throw soft pools of light
on the tiles.

[THE BUILDING'S NIGHT LINE]

Everything the lights do not reach falls into cool, dark blue shade: as
dark overall as a moonless night, with the platform lit only in small
pools right around each lamp post and nearly black-blue away from them.
Same style as the reference. Background: a single flat solid colour,
#0C1633 dark navy, filling the whole frame. No gradient, no glow on the
background.
```

How dark: the game darkens the ground at night to about half its day
brightness, with a blue cast, so a night image has to be at least that
dark to sit on it. The habitat's night images are right (their plain
platform tiles average about rgb(53, 52, 68)); the first reactor night
image came out twice as bright (about rgb(106, 93, 94)) and glows on the
dark map. The last sentence of the first paragraph above is there
because of it.

The night lines:

- **Habitat, good**: `Every window glows warm yellow, a light shines
  over the airlock door, and the small status light by the door glows
  green.`
- **Habitat, worn**: `The windows glow warm yellow, dimmed where dust is
  smeared on them, and the status light by the door glows amber.`
- **Habitat, damaged**: `Most windows glow a dim warm yellow, one window
  is dark, and the status light by the door glows red. The frost plume
  at the split seal catches the lamp light.`
- **Reactor**: `Small lights on the control box glow, and a red beacon
  glows at the top of the radiator cone. The reactor itself gives off no
  light: real reactors do not glow.`
- **Greenhouse**: `The tunnel glows a soft magenta pink from the red and
  blue LED grow lights inside, like the ones in the Veggie garden on the
  International Space Station, lighting the plants from within.`
- **Lab**: `The windows glow cool white with a hint of blue screens
  inside, a light shines over the door, and a small red light shows on
  the dish antenna.`
- **Solar field (each stage)**: `The panels are dark, with a faint sheen
  where the lamp light catches them, and a small green light glows on the
  power box.`

### Mars

One prompt for every Mars image except the O₂ plant: attach the Moon day
image with the same name (for example `moon/lab-day.png` for
`mars/lab.png`), then the Mars map (`terrain/mars-terrain.png`) as a
second image, and paste the building's line below into the prompt.

```
Use the first attached image as the exact reference: the same building,
platform, camera, framing and size, with nothing moved or redesigned.
The second attached image is the reference for the light and colours of
Mars only; do not copy its framing.

Move the building to Mars. Warm sunlight from the upper left with the
soft butterscotch cast of Mars's dusty air: left-facing walls lit,
right-facing walls in warm shade, softer shadows falling to the lower
right. Fine rust-orange dust has settled on every flat top and ledge and
on the platform tiles, with small drifts piled against the foot of the
walls. The paint keeps its colour under the dust: white stays white,
blue stays blue. The stone platform takes on the warm light but stays
grey stone.

[THE BUILDING'S MARS LINE]

Same style as the reference. No ground beyond the platform, no people,
no text. Background: a single flat solid colour, #0C1633 dark navy,
filling the whole frame. No gradient, no vignette, no glow, no shadow on
the background.
```

The Mars lines:

- **Habitat, good**: `Clean and well kept, with only a light film of
  dust; the status light by the door is green.`
- **Habitat, worn**: `Keep every sign of wear from the reference, with
  the dust rust-orange instead of grey; the status light is amber.`
- **Habitat, damaged**: `Keep every sign of damage from the reference,
  with the dust rust-orange instead of grey and piled higher against the
  walls; the status light is red.`
- **Solar field (each stage)**: `A thin film of orange dust dulls the
  panels, as it did on NASA's Spirit, Opportunity and InSight landers.
  Keep the number of panels and footings exactly as in the reference.`
- **Greenhouse**: `The plants inside stay bright green; the dust lies
  lightly on the curved panels and heavier along their bottom edge.`
- **Lab**: `Dust lies on the roof and around the dish antenna.`

**O₂ plant** (`mars/o2-plant.png`). Attach `mars/habitat-good.png`.

```
Use the attached image as the exact reference for the camera angle, the
framing, the stone platform, the Mars light, the dust and the render
style. Keep all of those identical, and replace the habitat with this
building:

An oxygen plant, a scaled-up version of MOXIE, the instrument on NASA's
Perseverance rover that made oxygen from Mars's air: a boxy white
processing building with blue panels and a large air intake grille (it
breathes in the carbon dioxide that makes up Mars's air), and behind it
three tall white oxygen tanks with blue bands, joined to it by pipes. A
door on the lower-right face. It covers about three quarters of the
platform.

The building stands in the middle of the platform with a walkway of tiles
around it, and nothing hangs over the platform's edges. Bold, simple
shapes that stay readable when the image is shown about 250 pixels wide.
No people, no text. Background: a single flat solid colour, #0C1633 dark
navy, filling the whole frame. No gradient, no vignette, no glow, no
shadow on the background.
```
