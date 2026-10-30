import { Globe, Moon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ScenarioId } from '../sim/types.ts'

// How long the arrival holds at least, so it reads as a moment rather than
// a flicker, and how long it takes to fade into the game.
const MIN_MS = 1300
const FADE_MS = 500

// Taking command: the world's base drifting slowly closer, its name and the
// day, while the map's pictures finish loading behind it. It holds until
// both the minimum time has passed and the map is ready (useArtReady caps
// that wait), then fades into the game. A click or a key skips it; that key
// is kept from the game, so it cannot also advance the sol.
export function Arrival({
  world,
  name,
  sol,
  missionLength,
  ready,
  onDone,
}: {
  world: ScenarioId
  name: string
  sol: number
  missionLength: number
  ready: boolean
  onDone: () => void
}) {
  const [minDone, setMinDone] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const leaving = skipped || (minDone && ready)

  const doneNow = useRef(onDone)
  useEffect(() => {
    doneNow.current = onDone
  })
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_MS)
    return () => clearTimeout(timer)
  }, [])
  useEffect(() => {
    if (!leaving) return
    const timer = setTimeout(() => doneNow.current(), FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setSkipped(true)
    }
    window.addEventListener('keydown', onKey, true) // before the game's own Enter handler
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const Icon = world === 'moon' ? Moon : Globe
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={() => setSkipped(true)}
      className={`fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center gap-4 bg-[#0c1633] p-6 transition-opacity duration-500 motion-reduce:transition-none ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="arrival-text text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">Sol by Sol</p>
      {/* The picture's edges fade into the page's own navy, so the base
          floats in space rather than sitting in a box. */}
      <div className="w-full max-w-2xl overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_50%,transparent_72%)]">
        <img src={`/art/start-${world}.webp`} alt="" width={720} height={360} className="arrival-zoom block aspect-[2/1] w-full object-cover" />
      </div>
      <div className="arrival-text text-center" style={{ animationDelay: '150ms' }}>
        <h2 className="flex items-center justify-center gap-2 text-3xl font-extrabold">
          <Icon size={26} className={world === 'moon' ? 'text-amber-200' : 'text-red-400'} aria-hidden /> {name}
        </h2>
        <p className="mt-1 text-slate-300">
          Sol {sol} of {missionLength} · Taking command
        </p>
      </div>
      {/* While the map's pictures are still coming, a bar runs; once they
          are in, it fills. */}
      <div className="arrival-text h-1 w-40 overflow-hidden rounded-full bg-slate-800" style={{ animationDelay: '300ms' }} aria-hidden>
        <div className={`h-full rounded-full bg-sky-300 ${ready ? 'w-full transition-[width] duration-300' : 'arrival-bar w-1/3'}`} />
      </div>
    </div>
  )
}
