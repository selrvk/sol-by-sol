import type { GameEvent, GameEventKind } from '../sim/types.ts'

const ICONS: Record<GameEventKind, string> = {
  eventStart: '⚠️',
  eventResolved: '✅',
  dustStormStart: '🌪️',
  dustStormEnd: '🌤️',
  nightfall: '🌑',
  sunrise: '🌅',
  loadShed: '🔌',
  resupply: '📦',
  info: 'ℹ️',
}

// Newest first. The latest sol is highlighted so it is clear what just
// happened after pressing Advance.
export function MissionLog({ log }: { log: GameEvent[] }) {
  const entries = log.slice(-15).reverse()
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Nothing to report yet. Press Advance sol to begin.</p>
  }
  const latestSol = entries[0].sol
  return (
    <ol aria-label="Mission log" className="max-h-44 space-y-1 overflow-y-auto pr-1 text-sm">
      {entries.map((e, i) => (
        <li key={`${e.sol}-${i}`} className={`flex gap-2 ${e.sol === latestSol ? 'text-slate-100' : 'text-slate-500'} ${i === 0 ? 'log-in' : ''}`}>
          <span className="w-14 shrink-0 tabular-nums text-slate-500">Sol {e.sol}</span>
          <span aria-hidden>{ICONS[e.kind]}</span>
          <span>{e.kind === 'eventStart' ? `Alert: ${e.message}` : e.message}</span>
        </li>
      ))}
    </ol>
  )
}
