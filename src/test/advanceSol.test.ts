// Unit tests for the simulation. Run with: npm test
// Uses Node's built-in test runner, so no extra dependencies.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { POLICIES } from '../../scripts/policies.ts'
import { advanceSol } from '../sim/advanceSol.ts'
import { newGame } from '../sim/newGame.ts'
import { mars } from '../sim/scenarios/mars.ts'
import { moon } from '../sim/scenarios/moon.ts'
import type { Decisions, GameState, Scenario } from '../sim/types.ts'

// A scenario with parts of its starting state replaced.
function withStart(base: Scenario, start: Partial<Scenario['start']>, extra: Partial<Scenario> = {}): Scenario {
  return { ...base, ...extra, start: { ...base.start, ...start } }
}

function plan(state: GameState, task: Decisions['assignments'][string] = 'labScience'): Decisions {
  return {
    assignments: Object.fromEntries(state.crew.map((m) => [m.id, task])),
    power: { lab: true, greenhouse: true, isru: true },
  }
}

function playOut(scenario: Scenario, seed: number, policy = POLICIES.balanced): GameState {
  let state = newGame(scenario, seed)
  while (state.outcome.status === 'playing') state = advanceSol(state, policy(state))
  return state
}

describe('advanceSol', () => {
  it('loses when the crew runs out of food', () => {
    const scenario = withStart(moon, {
      resources: { ...moon.start.resources, foodKg: 3 },
      facilities: { ...moon.start.facilities, greenhouseM2: 0 },
    })
    const state = newGame(scenario, 1)
    const next = advanceSol(state, plan(state))
    assert.deepEqual(next.outcome, { status: 'lost', reason: 'food' })
    assert.equal(next.resources.foodKg, 0)
  })

  it('loses when life support cannot be powered (lunar night, flat battery)', () => {
    // Sol 15 is the first sol of the lunar night; the 5 kW reactor alone is
    // just short of what life support needs.
    const scenario = withStart(moon, {
      sol: 15,
      resources: { ...moon.start.resources, storedPowerKWh: 0 },
    })
    const state = newGame(scenario, 1)
    const next = advanceSol(state, plan(state))
    assert.equal(next.environment.isDaylight, false)
    assert.deepEqual(next.outcome, { status: 'lost', reason: 'power' })
  })

  it('switches off optional loads before life support', () => {
    const scenario = withStart(moon, { sol: 15, resources: { ...moon.start.resources, storedPowerKWh: 40 } })
    const state = newGame(scenario, 1)
    const next = advanceSol(state, plan(state))
    assert.equal(next.outcome.status, 'playing')
    assert.ok(next.lastReport!.shedLoads.includes('lab'))
  })

  it('loses when an astronaut passes the career radiation limit', () => {
    const crew = moon.start.crew.map((m, i) => (i === 3 ? { ...m, doseMSv: m.careerDoseLimitMSv - 0.1 } : m))
    const state = newGame(withStart(moon, { crew }), 1)
    const next = advanceSol(state, plan(state, 'fieldScience'))
    assert.deepEqual(next.outcome, { status: 'lost', reason: 'radiation' })
  })

  it('EVA work adds more radiation than indoor work', () => {
    const state = newGame(moon, 1)
    const indoor = advanceSol(state, plan(state, 'labScience'))
    const outside = advanceSol(state, plan(state, 'fieldScience'))
    assert.ok(outside.crew[0].doseMSv > indoor.crew[0].doseMSv)
  })

  it('wins a full mission on both worlds with a sensible plan', () => {
    for (const scenario of [moon, mars]) {
      const end = playOut(scenario, 1)
      assert.deepEqual(end.outcome, { status: 'won' }, `${scenario.id}: expected a win`)
      assert.ok(end.sciencePoints >= scenario.scienceTarget)
      assert.ok(end.sol <= scenario.missionLengthSols)
    }
  })

  it('is deterministic: the same seed and decisions replay exactly', () => {
    const a = playOut(mars, 42)
    const b = playOut(mars, 42)
    assert.deepEqual(a, b)
  })

  it('does not modify the state it is given', () => {
    const state = newGame(moon, 7)
    const snapshot = structuredClone(state)
    advanceSol(state, plan(state, 'maintenance'))
    assert.deepEqual(state, snapshot)
  })

  it('does nothing once the game is over', () => {
    const scenario = withStart(moon, { resources: { ...moon.start.resources, foodKg: 3 }, facilities: { ...moon.start.facilities, greenhouseM2: 0 } })
    const state = newGame(scenario, 1)
    const over = advanceSol(state, plan(state))
    assert.equal(advanceSol(over, plan(over)), over)
  })
})
