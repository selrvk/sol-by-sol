// UI state. The only game logic lives in /sim: this reducer just stores the
// player's choices and hands them to advanceSol.

import { advanceSol } from '../sim/advanceSol.ts'
import { newGame } from '../sim/newGame.ts'
import { mars } from '../sim/scenarios/mars.ts'
import { moon } from '../sim/scenarios/moon.ts'
import type { CrewId, CrewTask, Decisions, GameState, ScenarioId } from '../sim/types.ts'
import { OPENINGS } from './labels.ts'

export const SCENARIOS = { moon, mars }

type PowerSwitch = keyof Decisions['power']

// One row per sol for the trend charts. UI data only: the sim never sees it.
export interface HistoryPoint {
  sol: number
  power: number
  oxygen: number
  water: number
  food: number
  dose: number // highest career dose in the crew
  science: number
  night: boolean
  storm: boolean
}

export interface UiState {
  game: GameState | null
  previous: GameState | null // state before the last sol, for per-sol deltas
  decisions: Decisions
  history: HistoryPoint[]
}

function snapshot(g: GameState): HistoryPoint {
  return {
    sol: g.sol,
    power: Math.round(g.resources.storedPowerKWh),
    oxygen: Math.round(g.resources.oxygenKg * 10) / 10,
    water: Math.round(g.resources.waterL),
    food: Math.round(g.resources.foodKg),
    dose: Math.round(Math.max(...g.crew.map((m) => m.doseMSv)) * 10) / 10,
    science: g.sciencePoints,
    night: !g.environment.isDaylight,
    storm: g.environment.dustStormSolsLeft > 0,
  }
}

export type Action =
  | { type: 'start'; scenarioId: ScenarioId; seed: number }
  | { type: 'assign'; crewId: CrewId; task: CrewTask }
  | { type: 'swapTasks'; a: CrewId; b: CrewId }
  | { type: 'togglePower'; load: PowerSwitch }
  | { type: 'chooseEvent'; choiceId: string }
  | { type: 'reopenEvent' }
  | { type: 'advance' }
  | { type: 'quit' }
  | { type: 'restart' }


export const initialUiState: UiState = {
  game: null,
  previous: null,
  decisions: { assignments: {}, power: { lab: true, greenhouse: true, isru: true } },
  history: [],
}

// The whole game state is plain data, so an unfinished mission can be kept
// in the browser and picked up again after a refresh. Storage can be
// unavailable (private mode, blocked site data), so every access is guarded.
// The save holds the scenario too, so bump the version whenever the
// scenario's shape or rules change: a save from older rules is dropped
// rather than played under the new ones. v2: Moon dust and night rule.
// v3: Mars dust season.
const SAVE_KEY = 'jamt-save-v3'

export function loadSavedUiState(): UiState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return initialUiState
    const saved = JSON.parse(raw) as UiState
    if (!saved.game || saved.game.outcome?.status !== 'playing' || !saved.decisions?.assignments) return initialUiState
    return { ...saved, history: Array.isArray(saved.history) ? saved.history : [snapshot(saved.game)] }
  } catch {
    return initialUiState
  }
}

export function saveUiState(state: UiState): void {
  try {
    if (state.game && state.game.outcome.status === 'playing') localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    // Saving is a convenience; the game works without it.
  }
}

export function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'start': {
      const game = newGame(SCENARIOS[action.scenarioId], action.seed)
      const inherited = OPENINGS[action.scenarioId].inheritedTasks
      const assignments = Object.fromEntries(game.crew.map((m, i) => [m.id, inherited[i] ?? 'rest']))
      return {
        game,
        previous: null,
        decisions: { assignments, power: { lab: true, greenhouse: true, isru: true } },
        history: [snapshot(game)],
      }
    }
    case 'assign':
      return {
        ...state,
        decisions: {
          ...state.decisions,
          assignments: { ...state.decisions.assignments, [action.crewId]: action.task },
        },
      }
    case 'swapTasks': {
      const { a, b } = action
      const tasks = state.decisions.assignments
      return {
        ...state,
        decisions: { ...state.decisions, assignments: { ...tasks, [a]: tasks[b], [b]: tasks[a] } },
      }
    }
    case 'togglePower':
      return {
        ...state,
        decisions: {
          ...state.decisions,
          power: { ...state.decisions.power, [action.load]: !state.decisions.power[action.load] },
        },
      }
    case 'chooseEvent':
      return { ...state, decisions: { ...state.decisions, eventChoiceId: action.choiceId } }
    // Take the answer back before the sol is played. With no answer the
    // alert opens again, and Advance waits for it, as it did the first time.
    case 'reopenEvent':
      return { ...state, decisions: { ...state.decisions, eventChoiceId: undefined } }
    case 'advance': {
      if (!state.game || state.game.outcome.status !== 'playing') return state
      // Tasks and power switches carry over to the next sol; the event
      // answer is used once.
      const game = advanceSol(state.game, state.decisions)
      return {
        game,
        previous: state.game,
        decisions: { ...state.decisions, eventChoiceId: undefined },
        history: [...state.history, snapshot(game)],
      }
    }
    case 'restart':
      if (!state.game) return state
      return reducer(state, { type: 'start', scenarioId: state.game.scenario.id, seed: (state.game.rng.seed * 1103515245 + 12345) >>> 0 })
    case 'quit':
      return initialUiState
  }
}
