// Unit tests for the simulation. Run with: npm test
// Uses Node's built-in test runner, so no extra dependencies.

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkAll, SEEDS } from '../../scripts/expectations.ts'
import { POLICIES } from '../../scripts/policies.ts'
import { advanceSol, EVA_TASKS } from '../sim/advanceSol.ts'
import { resourceRates, taskEffects } from '../sim/effects.ts'
import { dustSeason, lightInfo, nightAhead, stormChance, stormPower } from '../sim/forecast.ts'
import { newGame } from '../sim/newGame.ts'
import { mars } from '../sim/scenarios/mars.ts'
import { moon } from '../sim/scenarios/moon.ts'
import type { CrewTask, Decisions, GameState, Scenario } from '../sim/types.ts'
import { BALANCE } from '../sim/balance.ts'
import { openingFixed, OPENINGS } from '../ui/labels.ts'

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
      // off once the Sun goes down, and, as the task list warns, brings
      // anyone working outside back in: outside work gets nothing done in
      // the dark, and the dust they bring in still wears the base.
      const dark = rationAtNight && !lightInfo(scenario, state.sol).isDaylight
      const tonight = tasks.map((t) => (dark && EVA_TASKS.has(t) ? 'labScience' : t))
      state = advanceSol(state, {
        assignments: Object.fromEntries(state.crew.map((m, i) => [m.id, tonight[i]])),
        power: { lab: !dark, greenhouse: !dark, isru: true },
        eventChoiceId: state.pendingEvent?.defaultChoiceId,
      })
    }
    return state
  }

  for (const scenario of [moon, mars]) {
    it(`${scenario.id}: following the briefing survives the opening crisis`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const end = playOpening(scenario, seed, true, 12)
        // The crisis the briefing names -- water on the Moon, oxygen on Mars
        // -- has to be survivable by doing what it says. The lunar night is a
        // separate, later lesson, and this run leaves every optional load
        // switched on right through it, which the two night tests below say
        // should cost you the battery. So a power loss after dark is the
        // designed outcome and is allowed here; nothing else is.
        const o = end.outcome
        if (o.status === 'playing') continue
        assert.ok(o.status === 'lost' && o.reason === 'power', `seed ${seed}: ${JSON.stringify(o)}`)
        assert.equal(lightInfo(scenario, end.sol - 1).isDaylight, false, `seed ${seed}: lost power in daylight`)
      }
    })

    it(`${scenario.id}: ignoring the briefing loses within 30 sols`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        assert.equal(playOpening(scenario, seed, false, 30).outcome.status, 'lost', `seed ${seed}`)
      }
    })

    // The briefing says what to watch go up; it has to go up on the very
    // first sol, whichever of the astronauts it points at the player picks.
    it(`${scenario.id}: the briefing's promise shows on the first sol`, () => {
      const opening = OPENINGS[scenario.id]
      for (let seed = 1; seed <= 30; seed++) {
        const state = newGame(scenario, seed)
        opening.inheritedTasks.forEach((from, k) => {
          if (!opening.fixFrom.includes(from)) return
          const tasks = opening.inheritedTasks.map((t, i) => (i === k ? opening.fixTask : t))
          const decisions: Decisions = {
            assignments: Object.fromEntries(state.crew.map((m, i) => [m.id, tasks[i]])),
            power: { lab: true, greenhouse: true, isru: true },
          }
          assert.ok(openingFixed(state, decisions), `seed ${seed}, crew ${k}: counts as the fix`)
          const next = advanceSol(state, decisions)
          if (scenario.id === 'moon') assert.ok(next.facilities.condition > state.facilities.condition, `seed ${seed}, crew ${k}: base condition`)
          else assert.ok(next.facilities.isruUnits > state.facilities.isruUnits, `seed ${seed}, crew ${k}: O2 makers`)
        })
      }
    })
  }

  // On the Moon, repairing with someone who was not outside leaves both
  // field scientists bringing dust in, which cancels the repair. So that
  // pick does not count as following the briefing, which keeps asking.
  it('moon: repairing with an indoor astronaut is not the briefing\'s fix', () => {
    const state = newGame(moon, 1)
    const tasks: CrewTask[] = ['maintenance', ...OPENINGS.moon.inheritedTasks.slice(1)]
    const decisions: Decisions = {
      assignments: Object.fromEntries(state.crew.map((m, i) => [m.id, tasks[i]])),
      power: { lab: true, greenhouse: true, isru: true },
    }
    assert.equal(openingFixed(state, decisions), false)
  })

  it('no random alerts in the quiet start', () => {
    for (const scenario of [moon, mars]) {
      for (let seed = 1; seed <= 100; seed++) {
        let state = newGame(scenario, seed)
        for (let i = 0; i < BALANCE.QUIET_START_SOLS; i++) {
          state = advanceSol(state, plan(state))
          assert.equal(state.pendingEvent, null, `${scenario.id} seed ${seed}, sol ${state.sol - 1}`)
        }
      }
    }
  })

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

// Mars's lesson: storms come in the dust season, so there is time to build
// for one. The game has to say when, and mean it.
describe('mars dust season', () => {
  const season = mars.dustStorm.season!

  it('is announced ahead, and storms are far likelier inside it', () => {
    assert.deepEqual(dustSeason(mars, season.fromSol - 10), { now: false, inSols: 10, fromSol: season.fromSol, toSol: season.toSol })
    assert.equal(dustSeason(mars, season.fromSol)!.now, true)
    assert.equal(dustSeason(mars, season.toSol + 1), null)
    assert.equal(dustSeason(moon, 50), null)
    assert.ok(stormChance(mars, season.fromSol) > 10 * stormChance(mars, season.fromSol - 1))
  })

  it('brings a storm in nearly every mission', () => {
    let stormy = 0
    for (let seed = 1; seed <= 50; seed++) {
      let state = newGame(mars, seed)
      let hit = false
      while (state.outcome.status === 'playing' && state.sol <= season.toSol) {
        state = advanceSol(state, POLICIES.balanced(state))
        if (state.sol - 1 >= season.fromSol && state.environment.dustStormSolsLeft > 0) hit = true
      }
      if (hit) stormy++
    }
    assert.ok(stormy >= 45, `a storm in the season in ${stormy}/50 missions`)
  })

  it('a storm sol makes the power the warning quotes', () => {
    let state = newGame(mars, 1)
    while (state.outcome.status === 'playing' && state.environment.dustStormSolsLeft === 0) state = advanceSol(state, POLICIES.balanced(state))
    const made = advanceSol(state, POLICIES.balanced(state)).lastReport!.powerGeneratedKWh
    assert.ok(Math.abs(made - stormPower(state).stormKWh) < 1e-9, `${made} vs ${stormPower(state).stormKWh}`)
  })
})

// The scripted players stand in for kinds of player. Each one has to keep
// doing what scripts/policies.ts says it does, so a balance change that
// quietly alters a lesson fails here rather than going unnoticed.
describe('balance', () => {
  it('every scripted player does what it is documented to do', () => {
    assert.deepEqual(checkAll(SEEDS).failures, [])
  })
})

// The task lines and "why?" panels quote these numbers to the player, so
// they have to be what a real sol does. Events are switched off so each sol
// shows the rule alone.
describe('what the UI says a task or resource does', () => {
  const quiet = (sc: Scenario): Scenario => ({ ...sc, eventChancePerSol: 0, speChancePerSol: 0 })
  const oneOn = (state: GameState, task: Decisions['assignments'][string], power = { lab: true, greenhouse: true, isru: true }): Decisions => ({
    assignments: Object.fromEntries(state.crew.map((m, i) => [m.id, i === 0 ? task : 'rest'])),
    power,
  })
  const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

  it('building tasks add what they say', () => {
    const state = newGame(quiet(mars), 1)
    const fx = taskEffects(state, plan(state))
    close(advanceSol(state, oneOn(state, 'greenhouse')).facilities.greenhouseM2 - state.facilities.greenhouseM2, fx.greenhouse.m2)
    close(advanceSol(state, oneOn(state, 'shielding')).facilities.shieldingLevel, fx.shielding.next)
    close(advanceSol(state, oneOn(state, 'isru')).facilities.isruUnits - state.facilities.isruUnits, 1)
  })

  it('maintenance repairs what it says, and the base wears what it says', () => {
    const state = newGame(quiet(moon), 1)
    const fx = taskEffects(state, oneOn(state, 'rest')).maintenance
    const idle = advanceSol(state, oneOn(state, 'rest')).facilities.condition
    const fixed = advanceSol(state, oneOn(state, 'maintenance')).facilities.condition
    close(state.facilities.condition - idle, fx.wear)
    close(fixed - idle, fx.repair)
  })

  it('work outside wears the base by the dust it says, and gets nothing done at night', () => {
    const day = newGame(quiet(moon), 1)
    const outside = oneOn(day, 'fieldScience')
    const fx = taskEffects(day, outside)
    assert.ok(fx.outside.works && fx.outside.dustWear > 0)
    const afterDay = advanceSol(day, outside)
    close(day.facilities.condition - afterDay.facilities.condition, fx.maintenance.wear)
    close(fx.maintenance.dustWear, fx.outside.dustWear)
    assert.equal(afterDay.lastReport!.scienceEarned, fx.fieldScience.science)

    let night = day
    while (lightInfo(moon, night.sol).isDaylight) night = advanceSol(night, oneOn(night, 'rest'))
    assert.equal(taskEffects(night, oneOn(night, 'fieldScience')).outside.works, false)
    assert.equal(advanceSol(night, oneOn(night, 'fieldScience')).lastReport!.scienceEarned, 0)
    const shielded = advanceSol(night, oneOn(night, 'shielding')).facilities.shieldingLevel
    assert.equal(shielded, night.facilities.shieldingLevel)
  })

  it('lab science earns nothing with the lab switched off', () => {
    const state = newGame(quiet(moon), 1)
    const off = { lab: false, greenhouse: true, isru: true }
    assert.equal(taskEffects(state, { ...plan(state), power: off }).labScience.labOn, false)
    assert.equal(advanceSol(state, oneOn(state, 'labScience', off)).lastReport!.scienceEarned, 0)
  })

  it('resources move at the rates the why? panel quotes', () => {
    const state = newGame(quiet(moon), 1) // Moon, daylight, no O2 makers
    const rates = resourceRates(state)
    const next = advanceSol(state, oneOn(state, 'rest', { lab: false, greenhouse: false, isru: false }))
    const d = next.lastReport!.resourceDeltas
    close(d.oxygenKg, -rates.crewUse.oxygenKg)
    close(d.waterL, -rates.crewUse.waterL + rates.recycledL)
    close(d.foodKg, -rates.crewUse.foodKg)
    close(next.lastReport!.powerGeneratedKWh, rates.sunKWh + rates.reactorKWh)
  })
})
