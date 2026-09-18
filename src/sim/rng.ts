import type { RngFn, RngState } from './types.ts'

export function createRng(seed: number): RngState {
  const s = seed >>> 0
  return { seed: s, state: s }
}

// Mulberry32: small, fast, good enough for a game. Pure: returns the next
// state instead of mutating.
export const nextRandom: RngFn = (rng) => {
  const state = (rng.state + 0x6d2b79f5) >>> 0
  let t = state
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, next: { seed: rng.seed, state } }
}
