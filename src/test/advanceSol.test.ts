// Unit tests for the simulation. Run with: npm test
// Uses Node's built-in test runner, so no extra dependencies.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { POLICIES } from '../../scripts/policies.ts'
import { advanceSol } from '../sim/advanceSol.ts'
import { lightInfo, nightAhead } from '../sim/forecast.ts'
import { newGame } from '../sim/newGame.ts'
import { mars } from '../sim/scenarios/mars.ts'
import { moon } from '../sim/scenarios/moon.ts'
import type { Decisions, GameState, Scenario } from '../sim/types.ts'
import { OPENINGS } from '../ui/labels.ts'

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

// The opening crisis must be fair: doing what the briefing says (and nothing
// else) survives it, and ignoring it does not.
describe('opening crisis', () => {
  const FIX = { moon: 'maintenance', mars: 'isru' } as const

  function playOpening(
    scenario: Scenario,
    seed: number,
    followBriefing: boolean,
    sols: number,
    rationAtNight = false,
  ): GameState {
    const tasks = [...OPENINGS[scenario.id].inheritedTasks]
    if (followBriefing) tasks[1] = FIX[scenario.id] // move one scientist to the fix
    let state = newGame(scenario, seed)
    while (state.outcome.status === 'playing' && state.sol < scenario.start.sol + sols) {
      // A player who reads the power meter switches the optional systems
      // off once the Sun goes down.
      const dark = rationAtNight && !lightInfo(scenario, state.sol).isDaylight
      state = advanceSol(state, {
        assignments: Object.fromEntries(state.crew.map((m, i) => [m.id, tasks[i]])),
        power: { lab: !dark, greenhouse: !dark, isru: true },
        eventChoiceId: state.pendingEvent?.defaultChoiceId,
      })
    }
    return state
  }

  for (const scenario of [moon, mars]) {
    it(`${scenario.id}: following the briefing survives the opening crisis`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        assert.equal(playOpening(scenario, seed, true, 12).outcome.status, 'playing', `seed ${seed}`)
      }
    })

    it(`${scenario.id}: ignoring the briefing loses within 30 sols`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        assert.equal(playOpening(scenario, seed, false, 30).outcome.status, 'lost', `seed ${seed}`)
      }
    })
  }

  // The Moon's second lesson: the long night has to be planned for. The
  // game must warn while there is still daylight to act in, and switching
  // the optional systems off must be enough to get through.
  it('moon: the coming night is announced with time to prepare', () => {
    let state = newGame(moon, 1)
    const warnings: number[] = []
    while (state.outcome.status === 'playing' && state.sol < moon.start.sol + 6) {
      const ahead = nightAhead(state)
      if (ahead) warnings.push(ahead.inSols)
      state = advanceSol(state, {
        assignments: Object.fromEntries(state.crew.map((m) => [m.id, 'labScience' as const])),
        power: { lab: true, greenhouse: true, isru: true },
      })
    }
    // Counts down to nightfall, and says the battery needs a real reserve.
    assert.deepEqual(warnings.slice(0, 5), [5, 4, 3, 2, 1])
    assert.ok(nightAhead(newGame(moon, 1))!.reserveKWh > 100)
  })

  it('moon: switching the lab and greenhouse off at night survives it', () => {
    // 25 sols covers the water crisis and the whole first night, including
    // seeds where two solar flares stall the repairs.
    for (let seed = 1; seed <= 30; seed++) {
      const end = playOpening(moon, seed, true, 25, true)
      assert.equal(end.outcome.status, 'playing', `seed ${seed} ended: ${JSON.stringify(end.outcome)}`)
    }
  })

  it('moon: leaving everything on through the night loses power', () => {
    let lost = 0
    for (let seed = 1; seed <= 20; seed++) {
      const end = playOpening(moon, seed, true, 25, false)
      if (end.outcome.status === 'lost' && end.outcome.reason === 'power') lost++
    }
    assert.ok(lost >= 15, `expected most runs to lose power, got ${lost}/20`)
  })
})
