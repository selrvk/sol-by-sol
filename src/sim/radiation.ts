// Radiation dose model. Two kinds of radiation behave very differently:
//   - Galactic cosmic rays (GCR): always there, barely stopped by shielding.
//   - Solar particle events (SPE): rare bursts, stopped well by a few g/cm².
// Shielding is measured in g/cm² of mass between the crew and space.

import { BALANCE } from './balance.ts'
import { c, curveAt } from './constants.ts'
import type { Facilities, Scenario } from './types.ts'

// Mass shielding inside the habitat: the structure plus piled regolith.
export function indoorShieldingGCm2(fac: Facilities): number {
  return c('HABITAT_WALL_G_CM2') + fac.shieldingLevel * BALANCE.REGOLITH_G_CM2_PER_LEVEL
}

// Fraction of the unshielded GCR dose that gets through this much shielding.
export function gcrTransmission(gPerCm2: number): number {
  return curveAt('GCR_DOSE_VS_SHIELDING', gPerCm2) / curveAt('GCR_DOSE_VS_SHIELDING', 0)
}

// Daily background (GCR) dose for one crew member.
// evaFraction = share of the sol spent outside in a spacesuit.
export function gcrDoseMSv(scenario: Scenario, fac: Facilities, evaFraction: number): number {
  const indoor = gcrTransmission(indoorShieldingGCm2(fac))
  return scenario.surfaceDoseMSvPerSol * (evaFraction + (1 - evaFraction) * indoor)
}

// Whole-event SPE dose behind the given local shielding. `scale` is the
// event's size as a fraction of the August 1972 event. On Mars the
// atmosphere adds its own shielding on top.
export function speDoseMSv(scenario: Scenario, scale: number, localGCm2: number): number {
  return scale * curveAt('SPE_1972_DOSE_VS_SHIELDING', scenario.atmosphereGCm2 + localGCm2)
}

export interface SpeDoses {
  sheltered: number // everyone in the storm shelter
  indoor: number    // working inside the habitat
  eva: number       // working outside for a shift
}

export function speDoses(scenario: Scenario, fac: Facilities, scale: number): SpeDoses {
  const indoorG = indoorShieldingGCm2(fac)
  const evaFraction = BALANCE.SHIFT_HOURS / scenario.hoursPerSol
  const indoor = speDoseMSv(scenario, scale, indoorG)
  return {
    sheltered: speDoseMSv(scenario, scale, indoorG + c('STORM_SHELTER_EXTRA_G_CM2')),
    indoor,
    eva: evaFraction * speDoseMSv(scenario, scale, 0) + (1 - evaFraction) * indoor,
  }
}
