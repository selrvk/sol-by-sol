// Which picture each building shows, and how big it is: shared by the map
// (BaseView) and by the preloader, which fetches a world's pictures before
// the player arrives there (preload.ts). The map's layout -- where each
// building stands -- stays in BaseView.

import { CREW_PORTRAITS } from './labels.ts'
import { lightInfo } from '../sim/forecast.ts'
import type { GameState, ScenarioId } from '../sim/types.ts'

export const ART = '/art'

export const terrainUrl = (world: ScenarioId) => `${ART}/${world}-terrain.webp`

// Each building image: its size as shipped, and where the middle of its
// stone platform sits inside it, as fractions of that size (both printed by
// art/process.py). The platform's middle is what gets placed on the ground
// point.
export interface Sprite {
  name: string
  px: [number, number]
  anchor: [number, number]
  single?: boolean // one image, no separate night art
  glint?: string // the solar cells alone, where the sunlight glint may fall
  daylight?: string // a filter for the day image: the world's light (MOON_LIGHT)
}
export type SpriteSize = Pick<Sprite, 'px' | 'anchor'>

// The cargo pad and the lander on it share one image box (art/process.py
// lines them up), anchored on the landing circle's centre.
export const LANDER: SpriteSize = { px: [619, 482], anchor: [0.501, 0.622] }

// Each world's buildings. art/process.py cuts a building's stages and its
// day and night to one box, so they share a size and anchor. Only the Moon
// has the reactor (Mars runs on solar), and only Mars has the O₂ plant,
// which stands on the pad the reactor leaves empty. Mars has no night, so
// its images are day only.
type Everywhere = 'habitat' | 'solar' | 'greenhouse' | 'lab'
export type Buildings<T> = Record<Everywhere, T> & Partial<Record<'reactor' | 'isru', T>>
const BUILDING_ART: Record<ScenarioId, Buildings<SpriteSize>> = {
  moon: {
    habitat: { px: [620, 410], anchor: [0.5, 0.554] },
    solar: { px: [620, 366], anchor: [0.5, 0.501] },
    reactor: { px: [619, 461], anchor: [0.501, 0.604] },
    greenhouse: { px: [619, 364], anchor: [0.501, 0.499] },
    lab: { px: [619, 410], anchor: [0.501, 0.553] },
  },
  mars: {
    habitat: { px: [619, 418], anchor: [0.501, 0.563] },
    solar: { px: [620, 368], anchor: [0.5, 0.503] },
    greenhouse: { px: [619, 366], anchor: [0.501, 0.501] },
    lab: { px: [620, 410], anchor: [0.5, 0.554] },
    isru: { px: [619, 452], anchor: [0.501, 0.596] },
  },
}

// Two buildings change with the game: the habitat shows the base's
// condition, and the solar field gains rows of panels as it is built.
// Where the stages change is a display choice, not a game rule; damaged
// starts where the habitat's label turns amber (see `worn` below).
function habitatStage(condition: number) {
  return condition >= 0.85 ? 'good' : condition >= 0.6 ? 'worn' : 'damaged'
}

function solarStage(game: GameState) {
  const built = game.facilities.solarArrayM2 / game.scenario.maxSolarArrayM2
  return built >= 0.85 ? 3 : built >= 0.6 ? 2 : 1
}

export function buildingSprites(game: GameState): Buildings<Sprite> {
  return spritesAt(game.scenario.id, habitatStage(game.facilities.condition), solarStage(game))
}

function spritesAt(world: ScenarioId, habitat: string, solarRows: number): Buildings<Sprite> {
  const sizes = BUILDING_ART[world]
  const sprite = (size: SpriteSize, file: string): Sprite =>
    world === 'moon'
      ? { name: `moon/${file}`, ...size, daylight: 'url(#moon-light)' }
      : { name: `${world}/${file}-day`, ...size, single: true }
  const solar = `solar-${solarRows}`
  return {
    habitat: sprite(sizes.habitat, `habitat-${habitat}`),
    solar: { ...sprite(sizes.solar, solar), glint: `${world}/${solar}-day-glint` },
    reactor: sizes.reactor && sprite(sizes.reactor, 'reactor'),
    greenhouse: sprite(sizes.greenhouse, 'greenhouse'),
    lab: sprite(sizes.lab, 'lab'),
    isru: sizes.isru && sprite(sizes.isru, 'o2-plant'),
  }
}

export const art = (s: Sprite, when: 'day' | 'night') => `${ART}/buildings/${s.name}${s.single ? '' : `-${when}`}.webp`

// The pictures behind a set of buildings, for one time of day or both: the
// day or night image of each, and the solar glint mask by day.
function spriteUrls(sprites: Buildings<Sprite>, when: 'day' | 'night' | 'both'): string[] {
  return Object.values(sprites).flatMap((s: Sprite | undefined) => {
    if (!s) return []
    const urls: string[] = []
    if (when !== 'night' || s.single) urls.push(art(s, 'day'))
    if (when !== 'day' && !s.single) urls.push(art(s, 'night'))
    if (when !== 'night' && s.glint) urls.push(`${ART}/buildings/${s.glint}.webp`)
    return urls
  })
}

const lander = (when: 'day' | 'night' | 'both') =>
  (when === 'day' ? ['lander-pad', 'lander-pod'] : when === 'night' ? ['lander-pad-night', 'lander-pod-night'] : ['lander-pad', 'lander-pad-night', 'lander-pod', 'lander-pod-night']).map(
    (n) => `${ART}/buildings/${n}.webp`,
  )

const portraits = (game: GameState) =>
  game.crew.flatMap((m) => {
    const p = CREW_PORTRAITS[m.id]
    return p ? [p.inside, p.eva] : []
  })

// What the map shows for this game right now: the ground, its buildings at
// their current stages and time of day, the cargo lander, and the crew's
// portraits (indoors and helmeted, both small). The map waits for these
// before it appears, so it arrives whole.
export function imagesFor(game: GameState): string[] {
  const when = lightInfo(game.scenario, game.sol).isDaylight ? 'day' : 'night'
  return [
    terrainUrl(game.scenario.id),
    ...spriteUrls(buildingSprites(game), when),
    ...(game.scenario.resupply ? lander(when) : []),
    ...portraits(game),
  ]
}

// Every picture a game on this world can show: both times of day and every
// stage of every building. Fetched quietly once the map is up, so nightfall,
// a habitat that wears down or a solar field that grows changes picture
// without a gap.
export function everyImageOf(game: GameState): string[] {
  const world = game.scenario.id
  const urls = new Set<string>([terrainUrl(world), ...(game.scenario.resupply ? lander('both') : []), ...portraits(game)])
  for (const habitat of ['good', 'worn', 'damaged']) {
    for (const rows of [1, 2, 3]) spriteUrls(spritesAt(world, habitat, rows), 'both').forEach((u) => urls.add(u))
  }
  return [...urls]
}
