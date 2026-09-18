// Read-only helpers that answer "what's coming?" for the UI. Pure, and built
// from the same rules advanceSol uses, so the UI never re-implements them.

import { c } from './constants.ts'
import type { GameState, Scenario } from './types.ts'

export interface LightInfo {
  isDaylight: boolean            // for the given sol
  solsUntilChange: number | null // sols until sunrise/nightfall; null on Mars
}

export function lightInfo(scenario: Scenario, sol: number): LightInfo {
  const cycle = scenario.dayNightCycle
  if (!cycle) return { isDaylight: true, solsUntilChange: null }
  const period = cycle.daySols + cycle.nightSols
  const pos = sol % period
  return pos < cycle.daySols
    ? { isDaylight: true, solsUntilChange: cycle.daySols - pos }
    : { isDaylight: false, solsUntilChange: period - pos }
}

export function nextResupplySol(scenario: Scenario, sol: number): number | null {
  const r = scenario.resupply
  if (!r) return null
  return Math.max(r.intervalSols, Math.ceil(sol / r.intervalSols) * r.intervalSols)
}

// Battery that life support alone will need to get through the current
// night or dust storm, given what the reactor and panels still make.
export function lifeSupportReserveKWh(state: GameState): { reserveKWh: number; hardSols: number } {
  const { scenario, facilities: f, environment: env } = state
  const light = lightInfo(scenario, state.sol)
  const night = !light.isDaylight
  const storm = env.dustStormSolsLeft > 0
  const hardSols = night ? (light.solsUntilChange ?? 0) : storm ? env.dustStormSolsLeft : 0
  const solarFactor = night ? 0 : storm ? scenario.dustStorm.solarFactor : 1
  const makesKWh =
    f.solarArrayM2 * scenario.solarKWhPerM2PerSol * c('SOLAR_PANEL_EFFICIENCY') * f.condition * solarFactor +
    f.reactorKW * scenario.hoursPerSol
  const lifeSupportKWh = c('LIFE_SUPPORT_KW') * scenario.hoursPerSol
  return { reserveKWh: Math.max(0, lifeSupportKWh - makesKWh) * hardSols, hardSols }
}
