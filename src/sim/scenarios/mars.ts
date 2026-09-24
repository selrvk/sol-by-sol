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
  scienceTarget: 490,
  solarKWhPerM2PerSol: c('MARS_CLEAR_SOL_INSOLATION_KWH_M2'),
  dayNightCycle: null, // day/night is already averaged into the daily insolation
  maxSolarArrayM2: 1200,
  dustStorm: {
    chancePerSol: 0.005, // balance placeholder
    minSols: 20,        // "dust storms cut solar for weeks"
    maxSols: 60,
    solarFactor: c('DUST_STORM_SOLAR_FACTOR'),
    // Mars has a dust season: the big storms mostly start in the half of
    // the Martian year when it is closest to the Sun. The game squeezes
    // it into a known stretch of the mission, so a storm is something to
    // prepare for rather than bad luck: with storms rare outside it, a
    // plan that never builds for one no longer wins by getting a calm
    // mission. When and how likely are balance.
    season: { fromSol: 50, toSol: 75, chancePerSol: 0.15 },
  },
  surfaceDoseMSvPerSol: c('MARS_SURFACE_DOSE_MSV_PER_DAY') * (HOURS_PER_SOL / 24),
  atmosphereGCm2: c('MARS_ATMOSPHERE_G_CM2'),
  speChancePerSol: 0.03,
  eventChancePerSol: 0.05,
  // Launch windows are ~26 months apart, longer than the mission: no resupply.
  resupply: null,
  evaDustWear: 0,
  outsideWorkAtNight: true,
  isruAvailable: true,
  // The player takes command mid-mission, on sol 40. Only one O₂ maker is
  // running and the crew breathes more than it makes: the first thing to
  // learn is building oxygen makers.
  start: {
    sol: 40,
    resources: { storedPowerKWh: 600, oxygenKg: 40, waterL: 250, foodKg: 600 },
    facilities: {
      solarArrayM2: 560,
      reactorKW: 0, // solar only: dust storms are the power threat
      batteryCapacityKWh: 800,
      greenhouseM2: 10,
      shieldingLevel: 1,
      isruUnits: 1,
      condition: 0.85,
    },
    crew: makeCrew([150, 280, 90, 450]),
    sciencePoints: 190,
  },
}
