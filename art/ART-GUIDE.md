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
| Buildings (current) | about 25–28°, one-offs 21–33° | | |
| True 2:1 | 26.57° | 26.57° | 0.50 |

So for anything new, ask for **2:1 isometric** and check the result
against the maps: edges between about 26° and 29° sit well on them.
Measured by fitting lines to the silhouette edges, ignoring the rocks.

## Lighting (every image)

- Sun from the **upper left**. Left-facing walls and the slab's left cliff
  face are lit; right-facing walls and the right cliff face are in shade.
  Short shadows fall to the **lower right**.
- Buildings are painted in **neutral daylight** on both worlds. Do not
  paint them orange for Mars: the game tints them with Mars light itself
  (`MARS_LIGHT` in `src/ui/BaseView.tsx`).
- No night versions of the maps are needed. The game darkens the ground
  itself. Buildings do need a night version (below).

## Style (every image)

Stylized 3D render of a game asset: a clean diorama look, soft ambient
occlusion, gentle bevels, no outlines. The existing building sheet
(`art/source/buildings/buildings-day.png`) is the reference.

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

- Each building stands on its **own square stone platform** (grey tiles,
  small lamp posts at the corners), the platform a diamond on the 2:1 grid.
- A building's platform is **about one fifth of the slab's width** across.
  All buildings share one scale: a bigger building gets a bigger platform,
  not a bigger zoom.
- Doors and entrances face the **lower right** (the front-right face).
- **Day and night pairs**: the night image is the same picture with the
  lights on (windows glowing, lamp posts lit), generated from the day image
  as a reference so nothing moves. The game cross-fades between them.
- Current layout: one sheet per time of day holding the five buildings in
  two rows (habitat, reactor, solar on top; greenhouse, lab below), in the
  same place on both sheets. `art/process.py` cuts them out. A single
  building in its own image (like `co2maker.png`) works too.

## Cargo pod

The Moon's cargo lander (Mars has no resupply, so it is Moon-only). It
follows the camera, lighting, style and background rules above: its own
square stone landing pad, the size of one building platform, with a day
and a night image. Modelled on real robotic Moon landers such as NASA's
commercial CLPS landers: four legs, gold-foil insulation, an engine bell
underneath, cargo on the deck. Prompts are below, with the maps'.

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
