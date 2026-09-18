import type { Decisions, GameState } from './types'

// Advance the simulation by one sol. Pure and deterministic: all randomness
// comes from state.rng, never Math.random().
export function advanceSol(state: GameState, decisions: Decisions): GameState {
  // TODO: implement in Stage 1.
  void decisions
  return state
}
