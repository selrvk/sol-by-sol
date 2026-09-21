// Notices what just happened so the UI can play a one-shot animation for it.
// Read-only: it watches game state and never changes it.

import { useEffect, useRef, useState } from 'react'
import type { GameState } from '../sim/types.ts'

export interface SolEffects {
  flare: boolean     // a solar particle event has just arrived
  resupply: boolean  // a cargo lander touched down this sol
  powerCut: boolean  // something was switched off for lack of power
}

const NONE: SolEffects = { flare: false, resupply: false, powerCut: false }
const HOLD_MS = 2200

export function useSolEffects(game: GameState | null): SolEffects {
  const [effects, setEffects] = useState<SolEffects>(NONE)
  const lastSol = useRef<number | null>(null)

  useEffect(() => {
    if (!game || lastSol.current === game.sol) return
    const first = lastSol.current === null
    lastSol.current = game.sol
    if (first) return // no replay of the past when a saved game is loaded

    const justPlayed = game.sol - 1
    const entries = game.log.filter((e) => e.sol === justPlayed)
    const next: SolEffects = {
      flare: game.pendingEvent?.id === 'solarParticleEvent',
      resupply: entries.some((e) => e.kind === 'resupply'),
      powerCut: entries.some((e) => e.kind === 'loadShed'),
    }
    // Nothing to show: any earlier effect is already clearing on its timer.
    if (!next.flare && !next.resupply && !next.powerCut) return
    // Reacting to a new sol is the point here: the animation is triggered by
    // the state change, then cleared on a timer.
    // oxlint-disable-next-line react/set-state-in-effect
    setEffects(next)
    const timer = setTimeout(() => setEffects(NONE), HOLD_MS)
    return () => clearTimeout(timer)
  }, [game])

  return effects
}
