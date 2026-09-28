"""Make the link-preview picture (public/og-image.jpg), 1200 x 630.

    python3 art/preview.py        (needs Pillow; run art/process.py first)

The Moon base in daylight, fully built, drawn from the game's own shipped
art the way the game places it: the building positions and sizes are read
from src/ui/BaseView.tsx, so a re-run follows any change to the layout. The
title goes in the empty sky at the top left. The font is macOS's Avenir
Next; on another system, point FONT at any bold font.
"""

import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ART = ROOT / 'public' / 'art'
FONT = '/System/Library/Fonts/Avenir Next.ttc'  # face 0 is Bold, 5 is Medium
SIZE = (1200, 630)

# Moon daylight, as the game applies it (MOON_LIGHT in BaseView.tsx).
MOON_LIGHT = (0.94, 0, 0, 0, 0, 1.01, 0, 0, 0, 0, 1.09, 0)


def read_layout() -> tuple[dict, dict, dict, float, tuple]:
    src = (ROOT / 'src' / 'ui' / 'BaseView.tsx').read_text()
    block = lambda start, end: src[src.index(start) : src.index(end, src.index(start))]
    pads = {k: (float(u), float(v)) for k, u, v in re.findall(r'(\w+): \{ u: ([\d.]+), v: ([\d.]+) \}', block('const PADS', 'as const'))}
    sprite = r'(\w+): \{ px: \[(\d+), (\d+)\], anchor: \[([\d.]+), ([\d.]+)\] \}'
    sizes = {k: ((int(w), int(h)), (float(ax), float(ay))) for k, w, h, ax, ay in re.findall(sprite, block('  moon: {\n    habitat', '  },'))}
    lander = re.search(r'const LANDER: SpriteSize = \{ px: \[(\d+), (\d+)\], anchor: \[([\d.]+), ([\d.]+)\] \}', src)
    sizes['landing'] = ((int(lander[1]), int(lander[2])), (float(lander[3]), float(lander[4])))
    corners = re.search(r"moon: \{ art: 'moon-terrain.webp', north: \[(\d+), (\d+)\], west: \[(\d+), (\d+)\], east: \[(\d+), (\d+)\] \}", src)
    n, w, e = [(int(corners[i]), int(corners[i + 1])) for i in (1, 3, 5)]
    scale = float(re.search(r'const BUILDING_SCALE = ([\d.]+)', src)[1])
    view = tuple(int(x) for x in re.search(r'const VIEW = \{ x: (\d+), y: (\d+), w: (\d+), h: (\d+) \}', src).groups())
    return pads, sizes, {'n': n, 'w': w, 'e': e}, scale, view


def main() -> None:
    pads, sizes, t, scale, view = read_layout()
    ground = lambda u, v: (
        t['n'][0] + u * (t['w'][0] - t['n'][0]) + v * (t['e'][0] - t['n'][0]),
        t['n'][1] + u * (t['w'][1] - t['n'][1]) + v * (t['e'][1] - t['n'][1]),
    )
    scene = Image.new('RGBA', (1536, 1024), (12, 22, 51, 255))  # the game's sky, #0c1633
    scene.alpha_composite(Image.open(ART / 'moon-terrain.webp').convert('RGBA'))

    def place(pad: str, path: Path) -> None:
        (w, h), (ax, ay) = sizes[pad]
        im = Image.open(path).convert('RGBA').resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        lit = im.convert('RGB').convert('RGB', matrix=MOON_LIGHT).convert('RGBA')
        lit.putalpha(im.getchannel('A'))
        x, y = ground(*pads[pad])
        scene.alpha_composite(lit, (round(x - ax * im.width), round(y - ay * im.height)))

    # Back to front, as the game draws them. Fully built: all nine panels,
    # the habitat in good repair, a lander on the pad.
    b = ART / 'buildings'
    for pad, path in [
        ('solar', b / 'moon' / 'solar-3-day.webp'),
        ('greenhouse', b / 'moon' / 'greenhouse-day.webp'),
        ('habitat', b / 'moon' / 'habitat-good-day.webp'),
        ('reactor', b / 'moon' / 'reactor-day.webp'),
        ('landing', b / 'lander-pad.webp'),
        ('landing', b / 'lander-pod.webp'),
        ('lab', b / 'moon' / 'lab-day.webp'),
    ]:
        place(pad, path)

    # The game's own crop of the map, widened to the preview's shape: full
    # width, trimmed from the bottom of the cliff.
    x, y, w, h = view
    crop = scene.crop((x, y, x + w, y + round(w * SIZE[1] / SIZE[0])))
    out = crop.resize(SIZE, Image.LANCZOS).convert('RGB')

    # The title runs over the edge of the ground, so the sky's navy fades in
    # behind it, strongest in the corner, and each letter gets a dark edge.
    fade = Image.new('L', SIZE, 0)
    fp = fade.load()
    for fy in range(260):
        for fx in range(620):
            d = max(fx / 620, fy / 260)
            fp[fx, fy] = round(230 * (1 - d) ** 1.5)
    out.paste(Image.new('RGB', SIZE, (12, 22, 51)), (0, 0), fade)

    draw = ImageDraw.Draw(out)
    title = ImageFont.truetype(FONT, 46, index=0)
    tagline = ImageFont.truetype(FONT, 26, index=5)
    edge = {'stroke_width': 2, 'stroke_fill': (12, 22, 51)}
    draw.text((44, 36), 'Junior Astronaut', font=title, fill=(255, 255, 255), **edge)
    draw.text((44, 88), 'Mission Trainer', font=title, fill=(255, 255, 255), **edge)
    draw.text((46, 150), 'Keep your crew alive.', font=tagline, fill=(186, 230, 253), **edge)
    draw.text((46, 184), 'Do the science.', font=tagline, fill=(186, 230, 253), **edge)
    out.save(ROOT / 'public' / 'og-image.jpg', 'JPEG', quality=86, optimize=True, progressive=True)
    print(f'og-image.jpg: {out.size[0]}x{out.size[1]}, {(ROOT / "public" / "og-image.jpg").stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
