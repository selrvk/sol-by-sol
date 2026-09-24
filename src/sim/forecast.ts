// Read-only helpers that answer "what's coming?" for the UI. Pure, and built
// from the same rules advanceSol uses, so the UI never re-implements them.

import { loadDemandKWh, solarKWh } from './advanceSol.ts'
import { c } from './constants.ts'
import type { Decisions, GameState, Scenario } from './types.ts'

// Chance a dust storm starts on this sol: higher in the dust season.
export function stormChance(scenario: Scenario, sol: number): number {
  const season = scenario.dustStorm.season
  return season && sol >= season.fromSol && sol <= season.toSol ? season.chancePerSol : scenario.dustStorm.chancePerSol
}

export interface DustSeason {
  now: boolean // the season has started
  inSols: number // sols until it starts; 0 once it has
  fromSol: number
  toSol: number
}

// The dust season on this sol: coming, or under way. Null where there is
// none, and once it is over.
export function dustSeason(scenario: Scenario, sol: number): DustSeason | null {
  const season = scenario.dustStorm.season
  if (!season || sol > season.toSol) return null
  return { now: sol >= season.fromSol, inSols: Math.max(0, season.fromSol - sol), fromSol: season.fromSol, toSol: season.toSol }
}

// What the base has to run on in a dust storm, against what it cannot do
// without: life support and, where the crew depends on them, the O₂ makers.
export function stormPower(state: GameState): { stormKWh: number; essentialKWh: number } {
  const { scenario, facilities: f } = state
  const demand = loadDemandKWh(scenario, f)
  return {
    stormKWh: solarKWh(scenario, f, scenario.dustStorm.solarFactor) + f.reactorKW * scenario.hoursPerSol,
    essentialKWh: demand.lifeSupport + demand.isru,
  }
}

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

export interface NightAhead {
  inSols: number
  nightSols: number
  reserveKWh: number  // life support alone, for the whole night
  plannedKWh: number  // life support plus whatever is switched on
}

// What the coming night will cost, while there is still daylight to prepare
// in. Null on Mars (no night) and once night has fallen.
export function nightAhead(state: GameState, decisions?: Decisions): NightAhead | null {
  const { scenario, facilities: f } = state
  const cycle = scenario.dayNightCycle
  const light = lightInfo(scenario, state.sol)
  if (!cycle || !light.isDaylight || light.solsUntilChange === null) return null
  const demand = loadDemandKWh(scenario, f)
  const reactorKWh = f.reactorKW * scenario.hoursPerSol
  const optional = decisions
    ? (decisions.power.lab ? demand.lab : 0) +
      (decisions.power.greenhouse ? demand.greenhouse : 0) +
      (decisions.power.isru && scenario.isruAvailable ? demand.isru : 0)
    : 0
  const perSol = (extra: number) => Math.max(0, demand.lifeSupport + extra - reactorKWh) * cycle.nightSols
  return {
    inSols: light.solsUntilChange,
    nightSols: cycle.nightSols,
    reserveKWh: perSol(0),
    plannedKWh: perSol(optional),
  }
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
  const makesKWh = solarKWh(scenario, f, solarFactor) + f.reactorKW * scenario.hoursPerSol
  const lifeSupportKWh = c('LIFE_SUPPORT_KW') * scenario.hoursPerSol
  return { reserveKWh: Math.max(0, lifeSupportKWh - makesKWh) * hardSols, hardSols }
}
