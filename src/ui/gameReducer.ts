// UI state. The only game logic lives in /sim: this reducer just stores the
// player's choices and hands them to advanceSol.

import { advanceSol } from '../sim/advanceSol.ts'
import { newGame } from '../sim/newGame.ts'
import { mars } from '../sim/scenarios/mars.ts'
import { moon } from '../sim/scenarios/moon.ts'
import type { CrewId, CrewTask, Decisions, GameState, ScenarioId } from '../sim/types.ts'

export const SCENARIOS = { moon, mars }

type PowerSwitch = keyof Decisions['power']

export interface UiState {
  game: GameState | null
  previous: GameState | null // state before the last sol, for per-sol deltas
  decisions: Decisions
}

export type Action =
  | { type: 'start'; scenarioId: ScenarioId; seed: number }
  | { type: 'assign'; crewId: CrewId; task: CrewTask }
  | { type: 'togglePower'; load: PowerSwitch }
  | { type: 'chooseEvent'; choiceId: string }
  | { type: 'advance' }
  | { type: 'quit' }

const DEFAULT_TASKS: CrewTask[] = ['maintenance', 'labScience', 'fieldScience', 'labScience']

export const initialUiState: UiState = {
  game: null,
  previous: null,
  decisions: { assignments: {}, power: { lab: true, greenhouse: true, isru: true } },
}

export function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'start': {
      const game = newGame(SCENARIOS[action.scenarioId], action.seed)
      const assignments = Object.fromEntries(game.crew.map((m, i) => [m.id, DEFAULT_TASKS[i] ?? 'rest']))
      return {
        game,
        previous: null,
        decisions: { assignments, power: { lab: true, greenhouse: true, isru: true } },
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
    case 'advance': {
      if (!state.game || state.game.outcome.status !== 'playing') return state
      // Tasks and power switches carry over to the next sol; the event
      // answer is used once.
      return {
        game: advanceSol(state.game, state.decisions),
        previous: state.game,
        decisions: { ...state.decisions, eventChoiceId: undefined },
      }
    }
    case 'quit':
      return initialUiState
  }
}
