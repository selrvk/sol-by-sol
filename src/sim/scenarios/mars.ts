import { c } from '../constants.ts'
import type { Scenario } from '../types.ts'
import { makeCrew } from './crew.ts'

const HOURS_PER_SOL = c('MARS_SOL_HOURS')

// Physics-derived values are computed from constants.ts; everything else in
// this file is balance and may be tuned.
export const mars: Scenario = {
  id: 'mars',
  name: 'Mars outpost',
  hoursPerSol: HOURS_PER_SOL,
  missionLengthSols: 120,
  scienceTarget: 400,
  solarKWhPerM2PerSol: c('MARS_CLEAR_SOL_INSOLATION_KWH_M2'),
  dayNightCycle: null, // day/night is already averaged into the daily insolation
  maxSolarArrayM2: 600,
  dustStorm: {
    chancePerSol: 0.01, // balance placeholder
    minSols: 20,        // "dust storms cut solar for weeks"
    maxSols: 60,
    solarFactor: c('DUST_STORM_SOLAR_FACTOR'),
  },
  surfaceDoseMSvPerSol: c('MARS_SURFACE_DOSE_MSV_PER_DAY') * (HOURS_PER_SOL / 24),
  eventChancePerSol: 0.03,
  // Launch windows are ~26 months apart, longer than the mission: no resupply.
  resupply: null,
  isruAvailable: true,
  start: {
    sol: 0,
    resources: { storedPowerKWh: 300, oxygenKg: 250, waterL: 400, foodKg: 700 },
    facilities: {
      solarArrayM2: 300,
      reactorKW: c('REACTOR_UNIT_KW'),
      batteryCapacityKWh: 500,
      greenhouseM2: 4,
      shieldingLevel: 0,
      isruUnits: 1,
      condition: 1,
    },
    crew: makeCrew([120, 250, 60, 420]),
    sciencePoints: 0,
  },
}
