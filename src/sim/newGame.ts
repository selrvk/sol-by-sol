import { createRng } from './rng.ts'
import type { GameState, Scenario } from './types.ts'

export function newGame(scenario: Scenario, seed: number): GameState {
  const { start } = scenario
  return {
    scenario,
    sol: start.sol,
    resources: { ...start.resources },
    crew: start.crew.map((m) => ({ ...m })),
    facilities: { ...start.facilities },
    environment: { isDaylight: true, dustStormSolsLeft: 0, shelterSolsLeft: 0, busyShifts: 0, busyEvaShifts: 0 },
    sciencePoints: start.sciencePoints,
    rng: createRng(seed),
    pendingEvent: null,
    log: [],
    lastReport: null,
    outcome: { status: 'playing' },
  }
}
