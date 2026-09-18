// Presentation text only. No game rules here.

import type { ConstantKey, CurveKey } from '../sim/constants.ts'
import type { CrewTask, PowerLoad, ScenarioId } from '../sim/types.ts'

export const TASK_LABELS: Record<CrewTask, { label: string; icon: string; hint: string }> = {
  labScience: { label: 'Lab science', icon: '🔬', hint: 'Science points, needs the lab powered' },
  fieldScience: { label: 'Field science', icon: '🪨', hint: 'More science, but outside: extra radiation' },
  greenhouse: { label: 'Grow greenhouse', icon: '🌱', hint: 'More growing area: more food, more power' },
  solar: { label: 'Build solar', icon: '☀️', hint: 'More panels: more power in sunlight' },
  shielding: { label: 'Pile regolith', icon: '⛰️', hint: 'Shielding: protects against solar storms' },
  maintenance: { label: 'Maintenance', icon: '🔧', hint: 'Repairs wear: keeps water recycling and panels working' },
  isru: { label: 'Build O₂ maker', icon: '🫧', hint: 'Makes oxygen from the Martian air, uses power' },
  rest: { label: 'Rest', icon: '💤', hint: 'No work' },
}

export const POWER_LABELS: Record<PowerLoad, string> = {
  lifeSupport: 'Life support',
  isru: 'O₂ makers',
  greenhouse: 'Greenhouse',
  lab: 'Science lab',
}

export const SCENARIO_BLURBS: Record<ScenarioId, string> = {
  moon: 'Two weeks of sunlight, then two weeks of darkness. No air to stop radiation. Cargo landers visit every 30 sols.',
  mars: 'Solar power only, and dust storms can dim the Sun for weeks. The thin air blocks some radiation. No resupply.',
}

// Which sourced figures each meter's "why?" tooltip shows.
export type WhyRef = { constant: ConstantKey } | { curve: CurveKey } | { rule: string }

export const METER_SOURCES: Record<string, (scenario: ScenarioId) => WhyRef[]> = {
  power: (sc) => [
    { constant: 'LIFE_SUPPORT_KW' },
    { constant: sc === 'moon' ? 'SOLAR_FLUX_MOON' : 'MARS_CLEAR_SOL_INSOLATION_KWH_M2' },
    sc === 'moon' ? { constant: 'REACTOR_UNIT_KW' } : { constant: 'DUST_STORM_SOLAR_FACTOR' },
  ],
  oxygen: (sc) => [
    { constant: 'CREW_O2_KG_PER_DAY' },
    ...(sc === 'mars' ? [{ constant: 'MOXIE_KWH_PER_KG_O2' } as WhyRef] : []),
  ],
  water: () => [{ constant: 'CREW_WATER_L_PER_DAY' }, { constant: 'WATER_RECOVERY_FRACTION' }],
  food: () => [{ constant: 'CREW_FOOD_KG_PER_DAY' }, { constant: 'GREENHOUSE_YIELD_KG_M2_PER_DAY' }],
  radiation: (sc) => [
    { constant: sc === 'moon' ? 'MOON_SURFACE_DOSE_MSV_PER_DAY' : 'MARS_SURFACE_DOSE_MSV_PER_DAY' },
    { constant: 'CAREER_DOSE_LIMIT_MSV' },
    { curve: 'SPE_1972_DOSE_VS_SHIELDING' },
  ],
  crewTime: () => [
    { rule: 'Each astronaut works one 8-hour shift per sol. This is a game rule, not a NASA figure.' },
  ],
}
