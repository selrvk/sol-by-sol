"""Make the pictures of the whole base, drawn from the game's own art.

    python3 art/preview.py        (needs Pillow; run art/process.py first)

- public/og-image.jpg, 1200 x 630: the link preview. The Moon base in
  daylight, fully built, with the title in the empty sky at the top left.
- public/art/start-moon.webp, start-mars.webp: the start screen's two world
  cards. Each base as the player finds it on taking command: the Moon's worn
  out, with its first row of panels; Mars's in repair, with one O2 plant.

The buildings are placed the way the game places them: their positions and
sizes are read from src/ui/BaseView.tsx, so a re-run follows any change to
the layout. The font is macOS's Avenir Next; on another system, point FONT
at any bold font.
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public' / 'art'
FONT = '/System/Library/Fonts/Avenir Next.ttc'  # face 0 is Bold, 5 is Medium
SKY = (12, 22, 51)  # the game's sky, #0c1633

# Moon daylight, as the game applies it (MOON_LIGHT in BaseView.tsx). Mars's
# art is painted in Mars light and is drawn as it is.
MOON_LIGHT = (0.94, 0, 0, 0, 0, 1.01, 0, 0, 0, 0, 1.09, 0)

SRC = (ROOT / 'src' / 'ui' / 'BaseView.tsx').read_text()


def block(start: str, end: str) -> str:
    i = SRC.index(start)
    return SRC[i : SRC.index(end, i)]


SPRITE = r'(\w+): \{ px: \[(\d+), (\d+)\], anchor: \[([\d.]+), ([\d.]+)\] \}'
PADS = {k: (float(u), float(v)) for k, u, v in re.findall(r'(\w+): \{ u: ([\d.]+), v: ([\d.]+) \}', block('const PADS', 'as const'))}
SCALE = float(re.search(r'const BUILDING_SCALE = ([\d.]+)', SRC)[1])
VIEW = tuple(int(x) for x in re.search(r'const VIEW = \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}', SRC).groups())


def world_layout(world: str) -> tuple[dict, dict]:
    """The world's building sizes (plus the cargo lander's) and slab corners."""
    sizes = {k: ((int(w), int(h)), (float(ax), float(ay))) for k, w, h, ax, ay in re.findall(SPRITE, block(f'  {world}: {{\n    habitat', '  },'))}
    lander = re.search(r'const LANDER: SpriteSize = \{ px: \[(\d+), (\d+)\], anchor: \[([\d.]+), ([\d.]+)\] \}', SRC)
    sizes['lander'] = ((int(lander[1]), int(lander[2])), (float(lander[3]), float(lander[4])))
    c = re.search(world + r": \{ art: '[\w-]+\.webp', north: \[(\d+), (\d+)\], west: \[(\d+), (\d+)\], east: \[(\d+), (\d+)\] \}", SRC)
    return sizes, {'n': (int(c[1]), int(c[2])), 'w': (int(c[3]), int(c[4])), 'e': (int(c[5]), int(c[6]))}


def base_scene(world: str, buildings: list[tuple[str, str, str]]) -> tuple[Image.Image, tuple]:
    """The world's slab with buildings on it: (pad, size key, image) each,
    back to front as the game draws them. Returns the game's own crop, and
    the box the buildings take up inside it."""
    sizes, t = world_layout(world)
    ground = lambda u, v: (
        t['n'][0] + u * (t['w'][0] - t['n'][0]) + v * (t['e'][0] - t['n'][0]),
        t['n'][1] + u * (t['w'][1] - t['n'][1]) + v * (t['e'][1] - t['n'][1]),
    )
    scene = Image.new('RGBA', (1536, 1024), (*SKY, 255))
    scene.alpha_composite(Image.open(ART / f'{world}-terrain.webp').convert('RGBA'))
    vx, vy, vw, vh = VIEW
    box = None
    for pad, key, path in buildings:
        (w, h), (ax, ay) = sizes[key]
        im = Image.open(ART / 'buildings' / path).convert('RGBA').resize((round(w * SCALE), round(h * SCALE)), Image.LANCZOS)
        if world == 'moon':
            lit = im.convert('RGB').convert('RGB', matrix=MOON_LIGHT).convert('RGBA')
            lit.putalpha(im.getchannel('A'))
            im = lit
        x, y = ground(*PADS[pad])
        at = (round(x - ax * im.width), round(y - ay * im.height))
        scene.alpha_composite(im, at)
        placed = (at[0] - vx, at[1] - vy, at[0] + im.width - vx, at[1] + im.height - vy)
        box = placed if box is None else (min(box[0], placed[0]), min(box[1], placed[1]), max(box[2], placed[2]), max(box[3], placed[3]))
    return scene.crop((vx, vy, vx + vw, vy + vh)), box


def save(im: Image.Image, dst: Path, **opts) -> None:
    im.save(dst, **opts)
    print(f'{dst.name}: {im.size[0]}x{im.size[1]}, {dst.stat().st_size // 1024} KB')


def link_preview() -> None:
    size = (1200, 630)
    view, _ = base_scene('moon', [
        ('solar', 'solar', 'moon/solar-3-day.webp'),
        ('greenhouse', 'greenhouse', 'moon/greenhouse-day.webp'),
        ('habitat', 'habitat', 'moon/habitat-good-day.webp'),
        ('reactor', 'reactor', 'moon/reactor-day.webp'),
        ('landing', 'lander', 'lander-pad.webp'),
        ('landing', 'lander', 'lander-pod.webp'),
        ('lab', 'lab', 'moon/lab-day.webp'),
    ])
    # Widened to the preview's shape: full width, trimmed from the bottom of
    # the cliff.
    out = view.crop((0, 0, view.width, round(view.width * size[1] / size[0]))).resize(size, Image.LANCZOS).convert('RGB')

    # The title runs over the edge of the ground, so the sky's navy fades in
    # behind it, strongest in the corner, and each letter gets a dark edge.
    fade = Image.new('L', size, 0)
    fp = fade.load()
    for fy in range(260):
        for fx in range(620):
            fp[fx, fy] = round(230 * (1 - max(fx / 620, fy / 260)) ** 1.5)
    out.paste(Image.new('RGB', size, SKY), (0, 0), fade)

    draw = ImageDraw.Draw(out)
    title = ImageFont.truetype(FONT, 46, index=0)
    tagline = ImageFont.truetype(FONT, 26, index=5)
    edge = {'stroke_width': 2, 'stroke_fill': SKY}
    draw.text((44, 36), 'Junior Astronaut', font=title, fill=(255, 255, 255), **edge)
    draw.text((44, 88), 'Mission Trainer', font=title, fill=(255, 255, 255), **edge)
    draw.text((46, 150), 'Keep your crew alive.', font=tagline, fill=(186, 230, 253), **edge)
    draw.text((46, 184), 'Do the science.', font=tagline, fill=(186, 230, 253), **edge)
    save(out, ROOT / 'public' / 'og-image.jpg', format='JPEG', quality=86, optimize=True, progressive=True)


# The start screen's cards are about 350px wide, so 720 covers a 2x screen.
# Framed on the buildings, a 2:1 box around them all with a little ground
# to spare, so the rocky rim and the cliff mostly stay out.
CARD_SIZE = (720, 360)
CARD_MARGIN = 24


def frame(view: Image.Image, box: tuple) -> Image.Image:
    left, top, right, bottom = box[0] - CARD_MARGIN, box[1] - CARD_MARGIN, box[2] + CARD_MARGIN, box[3] + CARD_MARGIN
    ratio = CARD_SIZE[0] / CARD_SIZE[1]
    if (right - left) / (bottom - top) < ratio:  # too tall: widen about the middle
        grow = (bottom - top) * ratio - (right - left)
        left, right = left - grow / 2, right + grow / 2
    else:  # too wide: deepen about the middle
        grow = (right - left) / ratio - (bottom - top)
        top, bottom = top - grow / 2, bottom + grow / 2
    return view.crop(tuple(round(v) for v in (left, top, right, bottom))).resize(CARD_SIZE, Image.LANCZOS)


def start_cards() -> None:
    moon = base_scene('moon', [
        ('solar', 'solar', 'moon/solar-1-day.webp'),
        ('greenhouse', 'greenhouse', 'moon/greenhouse-day.webp'),
        ('habitat', 'habitat', 'moon/habitat-damaged-day.webp'),
        ('reactor', 'reactor', 'moon/reactor-day.webp'),
        ('landing', 'lander', 'lander-pad.webp'),
        ('landing', 'lander', 'lander-pod.webp'),
        ('lab', 'lab', 'moon/lab-day.webp'),
    ])
    mars = base_scene('mars', [
        ('solar', 'solar', 'mars/solar-1-day.webp'),
        ('greenhouse', 'greenhouse', 'mars/greenhouse-day.webp'),
        ('habitat', 'habitat', 'mars/habitat-good-day.webp'),
        ('reactor', 'isru', 'mars/o2-plant-day.webp'),
        ('lab', 'lab', 'mars/lab-day.webp'),
    ])
    for world, (view, box) in [('moon', moon), ('mars', mars)]:
        save(frame(view, box), ART / f'start-{world}.webp', format='WEBP', quality=84, method=6)


if __name__ == '__main__':
    link_preview()
    start_cards()
