import { c } from '../constants.ts'
import type { Scenario } from '../types.ts'
import { makeCrew } from './crew.ts'

const HOURS_PER_SOL = 24
const LUNAR_DAY_SOLS = Math.round(c('LUNAR_NIGHT_HOURS') / HOURS_PER_SOL) // 15

// Physics-derived values are computed from constants.ts; everything else in
// this file is balance and may be tuned.
export const moon: Scenario = {
  id: 'moon',
  name: 'Lunar outpost',
  hoursPerSol: HOURS_PER_SOL,
  missionLengthSols: 120,
  scienceTarget: 480,
  // Equatorial site, fixed horizontal panels: the mean of cos(sun angle)
  // over a lunar day is 2/π. 1361 W/m² × 24 h × 2/π ≈ 20.8 kWh/m² per sol.
  solarKWhPerM2PerSol: (c('SOLAR_FLUX_MOON') * HOURS_PER_SOL * (2 / Math.PI)) / 1000,
  dayNightCycle: { daySols: LUNAR_DAY_SOLS, nightSols: LUNAR_DAY_SOLS },
  maxSolarArrayM2: 300,
  dustStorm: { chancePerSol: 0, minSols: 0, maxSols: 0, solarFactor: 1 },
  surfaceDoseMSvPerSol: c('MOON_SURFACE_DOSE_MSV_PER_DAY') * (HOURS_PER_SOL / 24),
  eventChancePerSol: 0.03,
  // Earth is ~3 days away: regular cargo landers.
  resupply: {
    intervalSols: 30,
    cargo: { storedPowerKWh: 0, oxygenKg: 90, waterL: 60, foodKg: 180 },
  },
  isruAvailable: false,
  start: {
    sol: 0,
    resources: { storedPowerKWh: 300, oxygenKg: 200, waterL: 300, foodKg: 400 },
    facilities: {
      solarArrayM2: 100,
      reactorKW: c('REACTOR_UNIT_KW'),
      batteryCapacityKWh: 500,
      greenhouseM2: 0,
      shieldingLevel: 0,
      isruUnits: 0,
      condition: 1,
    },
    crew: makeCrew([120, 250, 60, 420]),
    sciencePoints: 0,
  },
}
