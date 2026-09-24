"""Turn the source art in art/source into the web-sized files the game ships.

    python3 art/process.py        (needs Pillow: pip install pillow)

- Buildings: two sheets, day and night, each holding the same five
  buildings in the same places. The exported alpha is soft (the bodies sit
  around 250, with a wide faint halo), so it is thresholded to a clean
  edge. Day and night share one crop box per building, so nothing shifts
  when night falls.
- Buildings, second set: one image per building, stage and time of day,
  in buildings/moon and buildings/mars (see cut_building_sets).
- Terrain: re-encoded as WebP, which is a fraction of the PNG's size.
- Crew: two portrait sheets, bare-headed and helmeted, split into discs.

Output goes to public/art/, which is what the game loads. The previous
generation of art is kept in art/source/v1 and is no longer processed.
"""

import collections
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'source'
OUT = ROOT.parent / 'public' / 'art'

# The five buildings on each sheet, in reading order: top row then bottom.
BUILDING_NAMES = ['habitat', 'reactor', 'solar', 'greenhouse', 'lab']
BUILDING_SHEETS = {'day': 'buildings-day.png', 'night': 'buildings-night.png'}


def sharpen_alpha(im: Image.Image) -> Image.Image:
    """Turn the soft exported alpha into a clean edge with a 1px feather.

    The building bodies come out around alpha 250 and the halo below 60,
    so a ramp between the two keeps the shapes and drops the haze that
    would otherwise glow against the dark ground.
    """
    im = im.convert('RGBA')
    a = im.split()[3].point(lambda v: 0 if v < 120 else (255 if v > 200 else int((v - 120) * 255 / 80)))
    im.putalpha(a)
    return im


def sprite_boxes(im: Image.Image, min_pixels: int = 20000) -> list[tuple[int, int, int, int]]:
    """Bounding boxes of the separate shapes on a sheet, in reading order."""
    a = im.split()[3].load()
    w, h = im.size
    seen = [[False] * h for _ in range(w)]
    found = []
    for sy in range(0, h, 3):
        for sx in range(0, w, 3):
            if seen[sx][sy] or a[sx, sy] < 128:
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
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and a[nx, ny] >= 128:
                        seen[nx][ny] = True
                        queue.append((nx, ny))
            if count > min_pixels:
                found.append(tuple(box))
    return sorted(found, key=lambda b: (b[1] // 300, b[0]))  # top row, then bottom


def cut_buildings() -> None:
    (OUT / 'buildings').mkdir(parents=True, exist_ok=True)
    sheets = {k: sharpen_alpha(Image.open(SRC / 'buildings' / f)) for k, f in BUILDING_SHEETS.items()}
    boxes = {k: sprite_boxes(im) for k, im in sheets.items()}
    for k, b in boxes.items():
        if len(b) != len(BUILDING_NAMES):
            raise SystemExit(f'{k} sheet: found {len(b)} buildings, expected {len(BUILDING_NAMES)}')
    # One box per building, covering both sheets, so the night version sits
    # exactly where the day one does. The night lamps glow a little wider.
    for i, name in enumerate(BUILDING_NAMES):
        box = union(boxes['day'][i], boxes['night'][i])
        for k, im in sheets.items():
            save(im.crop(box), OUT / 'buildings' / f'{name}-{k}.webp')


def save(im: Image.Image, dst: Path) -> None:
    # WebP for everything the game loads; PNG only for the favicons, which
    # browsers and phone home screens still want in a format they all know.
    if dst.suffix == '.png':
        im.save(dst, 'PNG', optimize=True)
    else:
        im.save(dst, 'WEBP', quality=88, method=6)
    print(f'{dst.name}: {im.size[0]}x{im.size[1]}, {dst.stat().st_size // 1024} KB')


def union(a, b):
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


# The portrait sheet: four discs on a flat background.
# Two sheets of the same four astronauts in the same accent colours: one
# bare-headed, one with helmets on. The game shows the helmet when that
# astronaut is assigned outside, so the crew card says at a glance who is
# on a spacewalk.
CREW_SHEETS = {
    '': SRC / 'people' / 'crewpeeps.png',
    '-eva': SRC / 'people' / 'crewpeeps-w-helmet.png',
}
CREW_NAMES = ['crew-1', 'crew-2', 'crew-3', 'crew-4']


def crew_discs(im: Image.Image) -> list[tuple[int, int, int, int]]:
    """Find the portrait discs, as (left, top, right, bottom) boxes."""
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
                found.append(tuple(box))
    return sorted(found, key=lambda b: (b[1] // 100, b[0]))  # reading order


def crop_crew() -> None:
    """Cut each sheet into four square avatars.

    These suits carry no agency insignia, so the whole disc is kept rather
    than a tight crop of the face. The square is centred on the disc and
    sized to its larger side, so the round CSS mask in the game lands
    exactly on the painted circle.
    """
    (OUT / 'crew').mkdir(parents=True, exist_ok=True)
    for suffix, sheet in CREW_SHEETS.items():
        if not sheet.exists():
            continue
        im = Image.open(sheet).convert('RGB')
        for name, (x0, y0, x1, y1) in zip(CREW_NAMES, crew_discs(im)):
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            half = max(x1 - x0, y1 - y0) // 2
            disc = im.crop((cx - half, cy - half, cx + half, cy + half)).resize((256, 256), Image.LANCZOS)
            save(disc, OUT / 'crew' / f'{name}{suffix}.webp')


# Art that already arrives with clean transparency: no cut-out to do, just
# trim the empty margin and re-encode.
def copy_cutout(src: Path, dst: Path, box: tuple = ()) -> None:
    if not src.exists():
        return
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    if box:
        im.thumbnail(box, Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    save(im, dst)


# The team's patch: the badge in the top bar, and the site icon.
#
# The artwork is a touch taller than it is wide, so it is centred on a
# square canvas first. Without that, a 32x32 favicon (and the 32x32 badge
# in the bar) would quietly squash it.
def make_patch() -> None:
    src = SRC / 'archspace-logo.png'
    if not src.exists():
        return
    im = Image.open(src).convert('RGBA')
    im = im.crop(im.getbbox())
    side = max(im.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    fit = lambda n: square.resize((n, n), Image.LANCZOS)
    save(fit(160), OUT / 'archspace-logo.webp')
    # A browser tab is 16-32px, where a downscale of the big one turns to
    # mush; a phone home screen wants 192.
    save(fit(32), OUT.parent / 'favicon-32.png')
    save(fit(192), OUT.parent / 'favicon-192.png')


def drop_flat_background(im: Image.Image) -> Image.Image:
    """Make a render's flat background colour transparent.

    Floods in from the image border, so dark parts enclosed by the object
    are kept even where they are close to the background colour.
    """
    im = im.convert('RGB')
    w, h = im.size
    px = im.load()
    sky = px[2, 2]
    near_sky = lambda p: all(abs(p[i] - sky[i]) < 26 for i in range(3))
    # Flood from the border, so dark rock enclosed by the slab is kept.
    mask = Image.new('L', (w, h), 255)
    m = mask.load()
    queue = collections.deque()
    for x in range(w):
        queue.extend([(x, 0), (x, h - 1)])
    for y in range(h):
        queue.extend([(0, y), (w - 1, y)])
    while queue:
        x, y = queue.popleft()
        if m[x, y] == 0 or not near_sky(px[x, y]):
            continue
        m[x, y] = 0
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and m[nx, ny]:
                queue.append((nx, ny))
    out = im.convert('RGBA')
    out.putalpha(mask.filter(ImageFilter.GaussianBlur(0.6)))
    return out


def cut_terrain(name: str) -> None:
    """Drop the render's flat sky, leaving the slab on transparency.

    The game draws its own sky behind it, so the slab needs no hand-drawn
    mask around it to sit on that sky cleanly.
    """
    save(drop_flat_background(Image.open(SRC / 'terrain' / f'{name}.png')), OUT / f'{name}.webp')


# The Moon's cargo lander comes as two images: the landing pad on its own,
# and the lander on its own, so the game can bring the lander down onto the
# pad. They were generated separately, and the lander came out larger and
# off-centre, so it is scaled and moved onto the pad here: the numbers
# carry each of its three visible footpads from lander-pod.png onto where
# they stood in the first render, which showed the lander on this pad.
# Both are then cut to one shared box, so the game can stack them exactly.
LANDER_SCALE = 0.744
LANDER_OFFSET = (150, 28)
LANDER_SHIP = 0.5  # the pad is drawn ~250px wide, so half size is plenty


def make_lander() -> None:
    pad = drop_flat_background(Image.open(SRC / 'buildings' / 'lander-pad.png'))
    raw = drop_flat_background(Image.open(SRC / 'buildings' / 'lander-pod.png'))
    raw = raw.resize((round(raw.width * LANDER_SCALE), round(raw.height * LANDER_SCALE)), Image.LANCZOS)
    pod = Image.new('RGBA', pad.size, (0, 0, 0, 0))
    pod.alpha_composite(raw, LANDER_OFFSET)
    box = union(pad.getbbox(), pod.getbbox())
    ship = lambda im: im.crop(box).resize((round((box[2] - box[0]) * LANDER_SHIP), round((box[3] - box[1]) * LANDER_SHIP)), Image.LANCZOS)
    save(ship(pad), OUT / 'buildings' / 'lander-pad.webp')
    save(ship(pod), OUT / 'buildings' / 'lander-pod.webp')
    print(f'lander box in the pad image: {box}; x{LANDER_SHIP} for the shipped files')


# The second set of buildings (art/ART-GUIDE.md): one building per image,
# each built on a copy of the cargo pad, so every platform is the same size
# and in the same place, on each world's folder (buildings/moon,
# buildings/mars). A building's images, its stages and its day and night,
# are cut to one shared box, so the game can swap and cross-fade them in
# place. The printed size and anchor go into SPRITES in BaseView.tsx.
PLATFORM_CENTRE = (628, 714)  # the platform's middle, in the 1254px renders
BUILDING_SHIP = 0.5  # drawn ~250px wide in the game, like the cargo pad


def bottom_edge(im: Image.Image) -> dict[int, int]:
    """The lowest solid pixel in each column: the platform's two front edges."""
    alpha = im.getchannel('A').load()
    w, h = im.size
    edge = {}
    for x in range(0, w, 4):
        for y in range(h - 1, -1, -1):
            if alpha[x, y] > 128:
                edge[x] = y
                break
    return edge


def onto_the_pad(im: Image.Image, pad_edge: dict[int, int]) -> tuple[Image.Image, int]:
    """Move a render up or down so its platform lies where the pad's does.

    The generator sometimes draws the platform a little higher in the frame
    (the first solar stages came out 31px up), which would make it jump when
    the game swaps stages. Found by sliding the platform's front edges onto
    the pad's.
    """
    edge = bottom_edge(im)
    xs = [x for x in edge if x in pad_edge and 200 <= x <= 1050]
    dy = min(range(-60, 61), key=lambda d: sum(abs(edge[x] + d - pad_edge[x]) for x in xs))
    if dy == 0:
        return im, 0
    moved = Image.new('RGBA', im.size, (0, 0, 0, 0))
    moved.alpha_composite(im, (0, dy))
    return moved, dy


def panels_only(im: Image.Image) -> Image.Image:
    """A mask of the solar cells alone: the blue pixels.

    The game runs the sunlight glint across the panels through it, so the
    light does not also sweep over the bare platform between them.
    """
    r, g, b, a = im.split()
    blue = Image.eval(Image.merge('RGB', (r, g, b)).convert('HSV').getchannel('H'), lambda h: 255 if 150 <= h <= 185 else 0)
    sat = Image.eval(Image.merge('RGB', (r, g, b)).convert('HSV').getchannel('S'), lambda s: 255 if s > 90 else 0)
    # Shrinking the outline first drops the navy fringe along its edge.
    mask = ImageChops.multiply(ImageChops.multiply(blue, sat), a.filter(ImageFilter.MinFilter(9)))
    white = Image.new('RGBA', im.size, (255, 255, 255, 0))
    white.putalpha(mask.filter(ImageFilter.GaussianBlur(1)))
    return white


def cut_building_sets() -> None:
    pad_edge = bottom_edge(drop_flat_background(Image.open(SRC / 'buildings' / 'lander-pad.png')))
    for folder in sorted(p for p in (SRC / 'buildings').iterdir() if p.is_dir() and p.name != 'v1'):
        groups = collections.defaultdict(list)
        for src in sorted(folder.glob('*.png')):
            groups[src.stem.split('-')[0]].append(src)
        for name, srcs in groups.items():
            cut = {}
            for src in srcs:
                cut[src.stem], dy = onto_the_pad(drop_flat_background(Image.open(src)), pad_edge)
                if dy:
                    print(f'{folder.name}/{src.stem}: platform moved {dy:+d}px onto the pad\'s')
            box = cut[srcs[0].stem].getbbox()
            for im in cut.values():
                box = union(box, im.getbbox())
            w, h = box[2] - box[0], box[3] - box[1]
            size = (round(w * BUILDING_SHIP), round(h * BUILDING_SHIP))
            dst = OUT / 'buildings' / folder.name
            dst.mkdir(parents=True, exist_ok=True)
            ship = lambda im: im.crop(box).resize(size, Image.LANCZOS)
            for stem, im in cut.items():
                save(ship(im), dst / f'{stem}.webp')
                if name == 'solar' and not stem.endswith('-night'):
                    save(ship(panels_only(im)), dst / f'{stem}-glint.webp')
            ax = (PLATFORM_CENTRE[0] - box[0]) / w
            ay = (PLATFORM_CENTRE[1] - box[1]) / h
            print(f'{folder.name}/{name}: px [{size[0]}, {size[1]}], anchor [{ax:.3f}, {ay:.3f}]')


def main() -> None:
    cut_buildings()
    cut_building_sets()
    # The O2 plant came separately, and already has its own transparency.
    copy_cutout(SRC / 'buildings' / 'co2maker.png', OUT / 'buildings' / 'co2maker.webp')
    make_lander()
    make_patch()
    crop_crew()
    for terrain in sorted(SRC.glob('terrain/*.png')):
        cut_terrain(terrain.stem)


if __name__ == '__main__':
    main()
