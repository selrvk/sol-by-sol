import {
  CircleCheck,
  CloudSun,
  Info,
  Moon,
  Package,
  PlugZap,
  Sunrise,
  Tornado,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import type { GameEvent, GameEventKind } from '../sim/types.ts'

// One icon per kind of entry, tinted so a warning reads differently from a
// delivery at a glance.
const ICONS: Record<GameEventKind, { icon: LucideIcon; tone: string }> = {
  eventStart: { icon: TriangleAlert, tone: 'text-amber-300' },
  eventResolved: { icon: CircleCheck, tone: 'text-emerald-300' },
  dustStormStart: { icon: Tornado, tone: 'text-orange-300' },
  dustStormEnd: { icon: CloudSun, tone: 'text-sky-300' },
  nightfall: { icon: Moon, tone: 'text-indigo-300' },
  sunrise: { icon: Sunrise, tone: 'text-yellow-300' },
  loadShed: { icon: PlugZap, tone: 'text-red-300' },
  resupply: { icon: Package, tone: 'text-violet-300' },
  info: { icon: Info, tone: 'text-slate-400' },
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
      {entries.map((e, i) => {
        const { icon: Icon, tone } = ICONS[e.kind]
        const recent = e.sol === latestSol
        return (
          <li key={`${e.sol}-${i}`} className={`flex gap-2 ${recent ? 'text-slate-100' : 'text-slate-500'} ${i === 0 ? 'log-in' : ''}`}>
            <span className="w-14 shrink-0 tabular-nums text-slate-500">Sol {e.sol}</span>
            <Icon size={15} aria-hidden className={`mt-0.5 shrink-0 ${recent ? tone : 'text-slate-600'}`} />
            <span>{e.kind === 'eventStart' ? `Alert: ${e.message}` : e.message}</span>
          </li>
        )
      })}
    </ol>
  )
}
