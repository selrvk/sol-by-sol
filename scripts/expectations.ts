// What each scripted player is expected to do on each world. Checked by
// `npm run balance` and by the test suite.
//
// The balance report used to only print its table. When the mid-mission
// opening (283cd92) let a fixed rota win the Moon, nothing failed, and the
// note saying it "should not win" stayed wrong until an audit found it.
// Now a change that alters one of these outcomes fails. If an outcome
// changes on purpose, update it here and in the policy's description in
// policies.ts, together.

import { advanceSol } from '../src/sim/advanceSol.ts'
import { newGame } from '../src/sim/newGame.ts'
import { mars } from '../src/sim/scenarios/mars.ts'
import { moon } from '../src/sim/scenarios/moon.ts'
import type { GameState, LossReason, Scenario, ScenarioId } from '../src/sim/types.ts'
import { POLICIES, type Policy } from './policies.ts'

export const SCENARIOS: Scenario[] = [moon, mars]

export function playOut(scenario: Scenario, policy: Policy, seed: number): GameState {
  let state = newGame(scenario, seed)
  while (state.outcome.status === 'playing') state = advanceSol(state, policy(state))
  return state
}

// One policy's results on one world, over seeds 1..N.
export interface Outcomes {
  runs: number
  won: number
  lost: Partial<Record<LossReason, number>>
  games: GameState[] // the final states, for the report's other columns
}

export function outcomes(scenario: Scenario, policy: Policy, seeds: number): Outcomes {
  const games = Array.from({ length: seeds }, (_, k) => playOut(scenario, policy, k + 1))
  const lost: Outcomes['lost'] = {}
  for (const g of games) {
    if (g.outcome.status === 'lost') lost[g.outcome.reason] = (lost[g.outcome.reason] ?? 0) + 1
  }
  return { runs: seeds, won: games.filter((g) => g.outcome.status === 'won').length, lost, games }
}

interface Expectation {
  says: string // finishes "expected it ...", for the failure message
  holds: (o: Outcomes) => boolean
}

// Shares rather than counts, so the same line holds at 20 seeds or 200.
// The margins leave room for a bad-luck seed, not for a real change.
const wins = (min: number): Expectation => ({
  says: `to win at least ${min * 100}% of the time`,
  holds: (o) => o.won >= min * o.runs,
})
const neverWins: Expectation = { says: 'never to win', holds: (o) => o.won === 0 }
const mostlyLoses = (reason: LossReason, min: number): Expectation => ({
  says: `to lose to ${reason} at least ${min * 100}% of the time`,
  holds: (o) => (o.lost[reason] ?? 0) >= min * o.runs,
})
const canLose = (reason: LossReason): Expectation => ({
  says: `to lose to ${reason} at least once`,
  holds: (o) => (o.lost[reason] ?? 0) > 0,
})

export const EXPECTED: Record<ScenarioId, Record<string, Expectation[]>> = {
  moon: {
    balanced: [wins(0.9)],
    greedy: [neverWins, mostlyLoses('water', 0.8)],
    reckless: [canLose('radiation')],
    'power-hog': [neverWins, mostlyLoses('power', 0.9)],
    cautious: [neverWins, mostlyLoses('missionTimeout', 0.9)],
    'rota-2m2f': [neverWins, mostlyLoses('food', 0.8)],
    'rota-1m3f': [neverWins, mostlyLoses('water', 0.9)],
    'day-night': [wins(0.9)],
  },
  mars: {
    balanced: [wins(0.9)],
    greedy: [neverWins, mostlyLoses('oxygen', 0.8)],
    reckless: [wins(0.9)],
    'power-hog': [wins(0.9)],
    cautious: [neverWins, mostlyLoses('missionTimeout', 0.9)],
    'rota-2m2f': [neverWins, mostlyLoses('oxygen', 0.9)],
    'rota-1m3f': [neverWins, mostlyLoses('oxygen', 0.9)],
    'day-night': [neverWins, mostlyLoses('oxygen', 0.9)],
  },
}

// Every way to lose has to be reachable by some policy on some world, or
// that loss screen, and its lesson, can never be seen.
const EVERY_LOSS: LossReason[] = ['oxygen', 'water', 'food', 'power', 'radiation', 'missionTimeout']

export interface Row {
  scenario: ScenarioId
  policy: string
  outcomes: Outcomes
  failed: string[]
}

export function checkAll(seeds: number): { rows: Row[]; failures: string[] } {
  const rows: Row[] = []
  for (const scenario of SCENARIOS) {
    for (const [name, policy] of Object.entries(POLICIES)) {
      const o = outcomes(scenario, policy, seeds)
      const expected = EXPECTED[scenario.id][name]
      // A new policy has to say what it is for before it counts as passing.
      const failed = expected ? expected.filter((e) => !e.holds(o)).map((e) => `expected it ${e.says}`) : ['has no expected outcome']
      rows.push({ scenario: scenario.id, policy: name, outcomes: o, failed })
    }
  }
  const failures = rows.flatMap((r) => r.failed.map((f) => `${r.scenario}/${r.policy}: ${f}`))
  for (const reason of EVERY_LOSS) {
    if (!rows.some((r) => (r.outcomes.lost[reason] ?? 0) > 0)) failures.push(`no policy on either world ever loses to ${reason}`)
  }
  return { rows, failures }
}
