"""Turn the source art in art/source into the web-sized files the game ships.

    python3 art/process.py        (needs Pillow: pip install pillow)

- Buildings: the AI exports have a solid white background, not real
  transparency. Everything near-white that touches the image edge is
  treated as background (white details inside a building are kept), the
  edge is eased by one pixel to avoid a light halo on dark ground, and the
  result is saved as a transparent WebP.
- Terrain: re-encoded as WebP, which is a fraction of the PNG's size.
- Crew: the portrait sheet is split into four avatars, cropped to the face.
  The crop deliberately stops above the chest, which also keeps the NASA
  insignia on the suits out of the game.

Output goes to public/art/, which is what the game loads.
"""

import collections
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'source'
OUT = ROOT.parent / 'public' / 'art'

BUILDINGS = {
    'habitat-day': 'Habitat-Day.png',
    'habitat-night': 'Habitat-Night.png',
    'lab-day': 'Lab-Day.png',
    'lab-night': 'Lab-Night.png',
    'greenhouse-day': 'Greenhouse-Day.png',
    'greenhouse-night': 'Greenhouse-Night.png',
    'reactor-day': 'Reactor-Day.png',
    'reactor-night': 'Reactor-Night.png',
    'solar': 'Solar-Panels.png',
}


def background_mask(im: Image.Image, threshold: int = 235) -> Image.Image:
    """Flood-fill near-white pixels connected to the border. 255 = background."""
    w, h = im.size
    px = im.load()
    mask = Image.new('L', (w, h), 0)
    m = mask.load()
    queue = collections.deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if m[x, y] or min(px[x, y]) < threshold:
            continue
        m[x, y] = 255
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not m[nx, ny]:
                queue.append((nx, ny))
    return mask


def cut_out(src: Path) -> Image.Image:
    im = Image.open(src).convert('RGB')
    w, h = im.size
    bg = background_mask(im)
    # Grow the background by a pixel, then soften: removes the white fringe.
    alpha = bg.filter(ImageFilter.MaxFilter(3)).point(lambda v: 255 - v).filter(ImageFilter.GaussianBlur(0.7))
    px, a = im.load(), alpha.load()
    out = Image.new('RGBA', (w, h))
    o = out.load()
    for y in range(h):
        for x in range(w):
            al = a[x, y]
            if al == 0:
                o[x, y] = (0, 0, 0, 0)
                continue
            r, g, b = px[x, y]
            if al < 255:  # un-mix the white background from edge pixels
                f = al / 255
                r, g, b = (max(0, min(255, int((c - 255 * (1 - f)) / f))) for c in (r, g, b))
            o[x, y] = (r, g, b, al)
    return out


def save(im: Image.Image, dst: Path) -> None:
    im.save(dst, 'WEBP', quality=88, method=6)
    print(f'{dst.name}: {im.size[0]}x{im.size[1]}, {dst.stat().st_size // 1024} KB')


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


# The portrait sheet: four discs on a flat background.
CREW_SHEET = SRC / 'people' / 'peopleicons.png'
CREW_NAMES = ['crew-1', 'crew-2', 'crew-3', 'crew-4']


def crew_discs(im: Image.Image) -> list[tuple[int, int, int]]:
    """Find the portrait discs: (centre x, centre y, radius)."""
    w, h = im.size
    px = im.load()
    bg = px[5, 5]
    is_bg = lambda p: all(abs(p[i] - bg[i]) < 24 for i in range(3))
    seen = [[False] * h for _ in range(w)]
    found = []
    for sy in range(0, h, 4):
        for sx in range(0, w, 4):
            if seen[sx][sy] or is_bg(px[sx, sy]):
                continue
            queue = collections.deque([(sx, sy)])
            seen[sx][sy] = True
            box = [sx, sy, sx, sy]
            count = 0
            while queue:
                x, y = queue.popleft()
                count += 1
                box = [min(box[0], x), min(box[1], y), max(box[2], x), max(box[3], y)]
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and not is_bg(px[nx, ny]):
                        seen[nx][ny] = True
                        queue.append((nx, ny))
            if count > 5000:
                found.append(((box[0] + box[2]) // 2, (box[1] + box[3]) // 2, (box[2] - box[0] + box[3] - box[1]) // 4))
    return sorted(found, key=lambda d: (d[1] // 100, d[0]))  # reading order


def crop_crew() -> None:
    if not CREW_SHEET.exists():
        return
    im = Image.open(CREW_SHEET).convert('RGB')
    discs = crew_discs(im)
    (OUT / 'crew').mkdir(parents=True, exist_ok=True)
    for name, (cx, cy, r) in zip(CREW_NAMES, discs):
        half = int(r * 0.62)          # stays inside the disc: no empty corners
        cy -= int(r * 0.20)           # centre on the face, above the suit badge
        face = im.crop((cx - half, cy - half, cx + half, cy + half)).resize((256, 256), Image.LANCZOS)
        save(face, OUT / 'crew' / f'{name}.webp')


def main() -> None:
    (OUT / 'buildings').mkdir(parents=True, exist_ok=True)
    cuts = {name: cut_out(SRC / 'buildings' / file) for name, file in BUILDINGS.items()}
    # Trim empty margins. Day and night versions share one crop box so they
    # line up exactly when the scene swaps between them.
    for name, im in cuts.items():
        box = im.getbbox()
        if name.endswith(('-day', '-night')):
            base = name.rsplit('-', 1)[0]
            box = union(cuts[f'{base}-day'].getbbox(), cuts[f'{base}-night'].getbbox())
        save(im.crop(box), OUT / 'buildings' / f'{name}.webp')
    crop_crew()
    terrain = Image.open(SRC / 'moon_terrain.png').convert('RGB')
    dst = OUT / 'moon-terrain.webp'
    terrain.save(dst, 'WEBP', quality=82, method=6)
    print(f'{dst.name}: {terrain.size[0]}x{terrain.size[1]}, {dst.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
