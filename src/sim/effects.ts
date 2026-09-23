// What each task does, and what moves each resource, in numbers. Read-only
// helpers for the UI, so it can say "+1 shielding, never wears off" instead
// of leaving the player to guess. Built from the same functions advanceSol
// runs, so the numbers the player reads are the numbers the game uses; the
// tests check a few of them against a real sol.

import { crewUse, greenhouseFoodKg, loadDemandKWh, solarKWh, wearPerSol } from './advanceSol.ts'
import { BALANCE } from './balance.ts'
import { c } from './constants.ts'
import { EVENTS } from './events.ts'
import { nextResupplySol } from './forecast.ts'
import { gcrDoseMSv, speDoses } from './radiation.ts'
import type { Decisions, Facilities, GameState, ResourceLevels } from './types.ts'

// A solar particle event of average size, halfway through the range the
// game rolls from. Used to show what shielding is worth.
const TYPICAL_STORM_SCALE = (BALANCE.SPE_SCALE_MIN + BALANCE.SPE_SCALE_MAX) / 2

export interface TaskEffects {
  labScience: { science: number; labOn: boolean }
  // Extra dose for working outside: every sol, and if a typical solar storm hits.
  fieldScience: { science: number; extraDoseMSv: number; stormExtraMSv: number }
  greenhouse: { m2: number; foodKg: number; powerKWh: number; wear: number }
  solar: { m2: number; sunKWh: number; maxM2: number; hasNight: boolean; hasStorms: boolean }
  shielding: {
    level: number
    next: number
    max: number
    // Dose inside the habitat from a typical solar storm, now and one level up.
    stormMSv: number
    stormNextMSv: number
    canBeLost: boolean // on the Moon a moonquake can shake a level loose
    airShields: boolean // Mars: the atmosphere is already shielding the base
  }
  maintenance: { repair: number; condition: number; wear: number }
  isru: { kgO2: number; powerKWh: number; wear: number; crewBreathesKg: number }
  rest: Record<string, never>
}

export function taskEffects(state: GameState, decisions: Decisions): TaskEffects {
  const { scenario, facilities: f } = state
  const withF = (patch: Partial<Facilities>): Facilities => ({ ...f, ...patch })

  const ghM2 = BALANCE.GREENHOUSE_M2_PER_SHIFT
  const solarM2 = Math.min(BALANCE.SOLAR_M2_PER_SHIFT, Math.max(0, scenario.maxSolarArrayM2 - f.solarArrayM2))
  const next = Math.min(BALANCE.MAX_SHIELDING_LEVEL, f.shieldingLevel + BALANCE.SHIELDING_LEVELS_PER_SHIFT)
  const evaFraction = BALANCE.SHIFT_HOURS / scenario.hoursPerSol
  const storm = speDoses(scenario, f, TYPICAL_STORM_SCALE)

  return {
    labScience: { science: BALANCE.LAB_SCIENCE_PER_SHIFT, labOn: decisions.power.lab },
    fieldScience: {
      science: BALANCE.FIELD_SCIENCE_PER_SHIFT,
      extraDoseMSv: gcrDoseMSv(scenario, f, evaFraction) - gcrDoseMSv(scenario, f, 0),
      stormExtraMSv: storm.eva - storm.indoor,
    },
    greenhouse: {
      m2: ghM2,
      foodKg: greenhouseFoodKg(scenario, ghM2),
      powerKWh: loadDemandKWh(scenario, withF({ greenhouseM2: ghM2 })).greenhouse,
      wear: wearPerSol(withF({ greenhouseM2: f.greenhouseM2 + ghM2 })) - wearPerSol(f),
    },
    solar: {
      m2: solarM2,
      sunKWh: solarKWh(scenario, withF({ solarArrayM2: solarM2 }), 1),
      maxM2: scenario.maxSolarArrayM2,
      hasNight: scenario.dayNightCycle !== null,
      hasStorms: scenario.dustStorm.chancePerSol > 0,
    },
    shielding: {
      level: f.shieldingLevel,
      next,
      max: BALANCE.MAX_SHIELDING_LEVEL,
      stormMSv: storm.indoor,
      stormNextMSv: speDoses(scenario, withF({ shieldingLevel: next }), TYPICAL_STORM_SCALE).indoor,
      canBeLost: EVENTS.some((e) => e.id === 'moonquake' && e.scenarios.includes(scenario.id)),
      airShields: scenario.atmosphereGCm2 > 0,
    },
    maintenance: { repair: BALANCE.MAINTENANCE_PER_SHIFT, condition: f.condition, wear: wearPerSol(f) },
    isru: {
      kgO2: BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL * BALANCE.ISRU_UNITS_PER_SHIFT,
      powerKWh: loadDemandKWh(scenario, withF({ isruUnits: BALANCE.ISRU_UNITS_PER_SHIFT })).isru,
      wear: wearPerSol(withF({ isruUnits: f.isruUnits + BALANCE.ISRU_UNITS_PER_SHIFT })) - wearPerSol(f),
      crewBreathesKg: crewUse(scenario, state.crew.length).oxygenKg,
    },
    rest: {},
  }
}

// What moves each resource, per sol, at today's base. The "goes up / goes
// down" half of each meter's "why?".
export interface ResourceRates {
  crewUse: ResourceLevels // storedPowerKWh here is life support, always on
  recycledL: number // water won back at today's base condition
  recyclerMax: number // the most it could win back, at full condition
  o2MakersKg: number // all O₂ makers, while powered
  greenhouseKg: number // the whole greenhouse, while powered
  reactorKWh: number
  sunKWh: number // clear sunlight, at today's condition
  battery: number
  wear: number
  cargo: { every: number; nextSol: number; cargo: ResourceLevels } | null
}

export function resourceRates(state: GameState): ResourceRates {
  const { scenario, facilities: f } = state
  const use = crewUse(scenario, state.crew.length)
  const demand = loadDemandKWh(scenario, f)
  const r = scenario.resupply
  return {
    crewUse: { ...use, storedPowerKWh: demand.lifeSupport },
    recycledL: use.waterL * c('WATER_RECOVERY_FRACTION') * f.condition,
    recyclerMax: c('WATER_RECOVERY_FRACTION'),
    o2MakersKg: scenario.isruAvailable ? f.isruUnits * BALANCE.ISRU_KG_O2_PER_UNIT_PER_SOL : 0,
    greenhouseKg: greenhouseFoodKg(scenario, f.greenhouseM2),
    reactorKWh: f.reactorKW * scenario.hoursPerSol,
    sunKWh: solarKWh(scenario, f, 1),
    battery: f.batteryCapacityKWh,
    wear: wearPerSol(f),
    cargo: r ? { every: r.intervalSols, nextSol: nextResupplySol(scenario, state.sol)!, cargo: r.cargo } : null,
  }
}
