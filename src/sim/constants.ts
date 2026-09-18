// Physical constants for the simulation.
//
// Each constant carries its source as data (not just a comment) so the UI's
// "why?" tooltips can show it at runtime.
//
// status:
//   verified    — checked against the primary source
//   unchecked   — from a real source, but not yet re-read at the source
//   placeholder — stand-in until a real source is found. NEVER cite these
//                 as fact in the UI. Find them all with: grep placeholder
//
// Game-balance numbers (science yields, event odds, starting stock) are NOT
// physics and live in balance.ts instead. Never tune these to balance the game.
//
// BVAD = NASA Life Support Baseline Values and Assumptions Document,
// NASA/TP-2015-218570/REV2, Feb 2022.
// https://ntrs.nasa.gov/api/citations/20210024855/downloads/BVAD_2.15.22-final.pdf

export type ConstantStatus = 'verified' | 'unchecked' | 'placeholder'

export interface SourcedConstant {
  value: number
  unit: string
  source: string
  status: ConstantStatus
  note?: string
}

export const CONSTANTS = {
  // --- Crew consumables (per crew member, per Earth day) ---

  CREW_O2_KG_PER_DAY: {
    value: 0.9,
    unit: 'kg/day',
    source: 'NASA BVAD Rev2 (2022), Tables 3-31 and 3-32',
    status: 'verified',
    note: 'Nominal 0.90 (range 0.61–1.08). The older 0.84 came from a since-corrected model error (footnote 77).',
  },
  CREW_WATER_L_PER_DAY: {
    value: 4.48,
    unit: 'L/day',
    source: 'NASA BVAD Rev2 (2022), Table 4-20, Early Planetary Base',
    status: 'verified',
    note: 'Drinking 2.00 + food rehydration 0.50 + toilet flush 0.50 + hygiene 0.40 + shower 1.08 (1 kg ≈ 1 L).',
  },
  CREW_FOOD_KG_PER_DAY: {
    value: 1.83,
    unit: 'kg/day',
    source: 'NASA BVAD Rev2 (2022), Table 4-47, ISS food as shipped',
    status: 'verified',
    note: 'Includes packaging. Current ISS planning value is 2.39; food actually eaten is ~1.56.',
  },

  // --- Time ---

  LUNAR_NIGHT_HOURS: {
    value: 354,
    unit: 'h',
    source: 'Half a synodic month (29.53 d / 2), NASA Moon Fact Sheet',
    status: 'unchecked',
  },
  MARS_SOL_HOURS: {
    value: 24.66,
    unit: 'h',
    source: 'NASA Mars Fact Sheet (length of day 24.6597 h)',
    status: 'unchecked',
  },

  // --- Power ---

  SOLAR_FLUX_MOON: {
    value: 1361,
    unit: 'W/m²',
    source: 'Total solar irradiance at 1 AU, Kopp & Lean (2011), GRL 38, L01706',
    status: 'unchecked',
  },
  SOLAR_FLUX_MARS: {
    value: 586,
    unit: 'W/m²',
    source: 'NASA Mars Fact Sheet (586.2 = 1361 / 1.5237²)',
    status: 'verified',
    note: 'Top of atmosphere. The often-quoted 590 (Appelbaum & Flood 1989) used an older solar constant of 1371.',
  },
  MARS_CLEAR_SOL_INSOLATION_KWH_M2: {
    value: 3.99,
    unit: 'kWh/m²/sol',
    source: 'Appelbaum & Flood (1989), NASA TM-102299, Table IV',
    status: 'verified',
    note: 'Daily global insolation on a horizontal surface at Viking Lander 1, Ls=153° (mean Sun distance): 3882 Wh/m² × 24.65/24.',
  },
  DUST_STORM_SOLAR_FACTOR: {
    value: 0.3,
    unit: 'fraction',
    source: 'Appelbaum & Flood (1989), NASA TM-102299',
    status: 'verified',
    note: '"About 30 percent of that in a clear day" at optical depth 3.25. Dust scatters light rather than blocking it.',
  },
  SOLAR_PANEL_EFFICIENCY: {
    value: 0.26,
    unit: 'fraction',
    source: 'NASA BVAD Rev2 (2022), power system tables (arrays listed at 22–26%)',
    status: 'unchecked',
  },
  REACTOR_UNIT_KW: {
    value: 10,
    unit: 'kWe',
    source: 'NASA Kilopower / KRUSTY test (2018): up to 10 kWe continuous',
    status: 'unchecked',
  },
  LIFE_SUPPORT_KW: {
    value: 5.31,
    unit: 'kW',
    source: 'NASA BVAD Rev2 (2022), Table 3-2: ISS ECLSS average power',
    status: 'verified',
    note: 'ISS figure for a larger crew; used unscaled for a 4-person base.',
  },

  // --- Food and water production ---

  WATER_RECOVERY_FRACTION: {
    value: 0.98,
    unit: 'fraction',
    source: 'NASA ISS ECLSS, 98% water recovery milestone (2023); ICES-2023-097',
    status: 'unchecked',
  },
  GREENHOUSE_YIELD_KG_M2_PER_DAY: {
    value: 0.105,
    unit: 'kg/m²/day',
    source: 'NASA BVAD Rev2 (2022), Table 4-90: white potato, fresh edible biomass',
    status: 'verified',
    note: '105.30 g/m²/day fresh. Counted against packaged-food mass as a simplification.',
  },
  GREENHOUSE_KWH_PER_KG_FOOD: {
    value: 100,
    unit: 'kWh/kg',
    source: 'NASA BVAD Rev2 (2022), Section 4.14: 1.6–10 g of biomass per kWh',
    status: 'unchecked',
    note: 'Uses the best reference (10 g/kWh, South Pole Food Growth Chamber). Unclear if that figure is edible or total biomass.',
  },

  // --- ISRU (Mars) ---

  MOXIE_KWH_PER_KG_O2: {
    value: 25,
    unit: 'kWh/kg',
    source: 'NASA/JPL MOXIE results (2023): peak 12 g/h O2 at ~300 W',
    status: 'unchecked',
    note: 'MOXIE was a ~1% scale demo; full-scale plants are expected to be more efficient.',
  },

  // --- Radiation ---

  MOON_SURFACE_DOSE_MSV_PER_DAY: {
    value: 1.369,
    unit: 'mSv/day',
    source: "Zhang et al. (2020), Sci. Adv. 6:eaaz1334, Chang'E 4 LND",
    status: 'unchecked',
  },
  MARS_SURFACE_DOSE_MSV_PER_DAY: {
    value: 0.64,
    unit: 'mSv/day',
    source: 'Hassler et al. (2014), Science 343:1244797, Curiosity RAD',
    status: 'unchecked',
  },
  CAREER_DOSE_LIMIT_MSV: {
    value: 600,
    unit: 'mSv',
    source: 'NASA-STD-3001 Vol. 1 Rev B (2022)',
    status: 'unchecked',
  },
  HABITAT_WALL_G_CM2: {
    value: 5,
    unit: 'g/cm²',
    source: 'Shavers et al. (2023), habitat cases of 5 and 20 g/cm² Al, as cited in Matthiä & Berger (2024), Table 2',
    status: 'unchecked',
    note: 'Shielding from the habitat structure itself; the thinner of the two modelled cases. Treated as equivalent to regolith.',
  },
  STORM_SHELTER_EXTRA_G_CM2: {
    value: 10,
    unit: 'g/cm²',
    source: 'TODO: SOURCE NEEDED',
    status: 'placeholder',
    note: 'Extra mass (water, supplies) around the storm-shelter area during a solar particle event.',
  },
  MARS_ATMOSPHERE_G_CM2: {
    value: 21,
    unit: 'g/cm²',
    source: 'Hassler et al. (2014); Guo et al. (2017), JGR Planets: mean column depth at Gale crater',
    status: 'unchecked',
    note: 'Already included in the measured Mars surface dose; used here only to scale solar particle events.',
  },
} satisfies Record<string, SourcedConstant>

// A dose curve: points of [shielding in g/cm², dose]. Values in between are
// linearly interpolated; beyond the last point the last value is used.
export interface SourcedCurve {
  points: [number, number][]
  unit: string
  source: string
  status: ConstantStatus
  note?: string
}

export const CURVES = {
  // Galactic cosmic rays: extra mass barely helps. Used as a fraction of the
  // unshielded value, so it applies on top of the measured surface doses.
  GCR_DOSE_VS_SHIELDING: {
    points: [[0, 299], [1, 288], [10, 228], [30, 212], [60, 213], [180, 200]],
    unit: 'mSv/year (lunar surface, solar minimum)',
    source: 'Matthiä & Berger (2024), Space Weather 22:e2024SW004095, Table 2 and abstract',
    status: 'verified',
    note: '~180 g/cm² of regolith cuts cosmic-ray dose by only ~25%. The 60 g/cm² point is slightly above 30 in the source (model noise).',
  },
  // Solar particle events: a few g/cm² makes a huge difference.
  SPE_1972_DOSE_VS_SHIELDING: {
    points: [[0, 533], [5, 88], [10, 37], [20, 14.3]],
    unit: 'mSv (blood-forming organs, whole event)',
    source: 'Matthiä & Berger (2024), Space Weather 22:e2024SW004095, Table 2: August 1972 event',
    status: 'verified',
    note: 'The 0 point is a person in a spacesuit only. The August 1972 event is one of the largest on record.',
  },
} satisfies Record<string, SourcedCurve>

export type ConstantKey = keyof typeof CONSTANTS
export type CurveKey = keyof typeof CURVES

// Short accessor used throughout the sim.
export function c(key: ConstantKey): number {
  return CONSTANTS[key].value
}

// Interpolate a dose curve at the given shielding (g/cm²).
export function curveAt(key: CurveKey, gPerCm2: number): number {
  const pts = CURVES[key].points
  if (gPerCm2 <= pts[0][0]) return pts[0][1]
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i]
    if (gPerCm2 <= x1) {
      const [x0, y0] = pts[i - 1]
      return y0 + ((gPerCm2 - x0) / (x1 - x0)) * (y1 - y0)
    }
  }
  return pts[pts.length - 1][1]
}
