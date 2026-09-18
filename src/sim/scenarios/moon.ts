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
  scienceTarget: 550,
  // Equatorial site, fixed horizontal panels: the mean of cos(sun angle)
  // over a lunar day is 2/π. 1361 W/m² × 24 h × 2/π ≈ 20.8 kWh/m² per sol.
  solarKWhPerM2PerSol: (c('SOLAR_FLUX_MOON') * HOURS_PER_SOL * (2 / Math.PI)) / 1000,
  dayNightCycle: { daySols: LUNAR_DAY_SOLS, nightSols: LUNAR_DAY_SOLS },
  maxSolarArrayM2: 300,
  dustStorm: { chancePerSol: 0, minSols: 0, maxSols: 0, solarFactor: 1 },
  surfaceDoseMSvPerSol: c('MOON_SURFACE_DOSE_MSV_PER_DAY') * (HOURS_PER_SOL / 24),
  atmosphereGCm2: 0,
  speChancePerSol: 0.03,
  eventChancePerSol: 0.05,
  // Earth is ~3 days away: regular cargo landers.
  resupply: {
    intervalSols: 30,
    cargo: { storedPowerKWh: 0, oxygenKg: 90, waterL: 60, foodKg: 120 },
  },
  isruAvailable: false,
  // The player takes command mid-mission, on sol 40. The previous commander
  // put everyone on science and skipped repairs, so the base is worn out and
  // the water recycler is failing: the first thing to learn is maintenance.
  start: {
    sol: 40,
    resources: { storedPowerKWh: 400, oxygenKg: 150, waterL: 60, foodKg: 300 },
    facilities: {
      solarArrayM2: 140,
      // A 5 kWe unit (Kilopower covers 1–10 kWe). Slightly less than life
      // support needs, so the battery must be rationed through the night.
      reactorKW: 5,
      batteryCapacityKWh: 500,
      greenhouseM2: 8,
      shieldingLevel: 2,
      isruUnits: 0,
      condition: 0.5,
    },
    crew: makeCrew([165, 295, 105, 465]),
    sciencePoints: 200,
  },
}
