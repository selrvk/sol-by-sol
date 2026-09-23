import {
  CircleCheck,
  CloudSun,
  History,
  Info,
  Moon,
  Package,
  PlugZap,
  ScrollText,
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

const text = (e: GameEvent) => (e.kind === 'eventStart' ? `Alert: ${e.message}` : e.message)

// One entry, the same way in the full log and in the last-sol recap.
function LogLine({ entry, dim = false }: { entry: GameEvent; dim?: boolean }) {
  const { icon: Icon, tone } = ICONS[entry.kind]
  return (
    <>
      <Icon size={15} aria-hidden className={`mt-0.5 shrink-0 ${dim ? 'text-slate-600' : tone}`} />
      <span>{text(entry)}</span>
    </>
  )
}

// Newest first. The latest sol is highlighted so it is clear what just
// happened after pressing Advance.
export function MissionLog({ log }: { log: GameEvent[] }) {
  const entries = log.slice(-15).reverse()
  const latestSol = entries[0]?.sol
  return (
    <section aria-label="Mission log" className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
        <ScrollText size={16} className="text-sky-300" aria-hidden /> Mission log
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">Nothing to report yet. Press Advance sol to begin.</p>
      ) : (
        <ol className="max-h-44 space-y-1 overflow-y-auto pr-1 text-sm">
          {entries.map((e, i) => {
            const recent = e.sol === latestSol
            return (
              <li key={`${e.sol}-${i}`} className={`flex gap-2 ${recent ? 'text-slate-100' : 'text-slate-500'} ${i === 0 ? 'log-in' : ''}`}>
                <span className="w-14 shrink-0 tabular-nums text-slate-500">Sol {e.sol}</span>
                <LogLine entry={e} dim={!recent} />
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

// What happened on the sol just played, where the player looks next. The
// full log is history, and it sits below the fold on a desktop and on
// another tab on a phone, so without this the story of a sol -- nightfall,
// a delivery, a system losing power -- went unread. Shown every sol, a
// quiet one included, so that it always answers "what just happened?" and
// the meters beneath it do not jump up and down.
export function LastSol({ log, sol }: { log: GameEvent[]; sol: number }) {
  const entries = log.filter((e) => e.sol === sol)
  return (
    // The live region stays put while its contents change, which is what a
    // screen reader needs to announce each new sol.
    <section aria-label="Last sol" aria-live="polite" className="rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2.5">
      <div key={sol} className="log-in">
        <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <History size={14} className="text-sky-300" aria-hidden /> Sol {sol}
        </h2>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">A quiet sol: nothing out of the ordinary.</p>
        ) : (
          <ul className="space-y-1 text-sm text-slate-100">
            {entries.map((e, i) => (
              <li key={i} className="flex gap-2">
                <LogLine entry={e} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
