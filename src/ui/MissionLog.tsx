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
import type { GameEvent, GameEventKind, GameState } from '../sim/types.ts'

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

// One row of the log: an entry, and the run of sols it was repeated on.
interface LogRow {
  entry: GameEvent
  from: number
  to: number
}

// The same message sol after sol -- the lab and greenhouse switched off
// through a whole lunar night -- is one row with its span, not a row a sol,
// which filled the log with copies and pushed everything else out of it.
// Newest first: a run that is still going moves up with its latest sol.
function logRows(log: GameEvent[]): LogRow[] {
  const rows: LogRow[] = []
  const runs = new Map<string, LogRow>()
  for (const entry of log) {
    const key = `${entry.kind}|${entry.message}`
    const run = runs.get(key)
    if (run && run.to === entry.sol - 1) {
      run.to = entry.sol
      continue
    }
    const row = { entry, from: entry.sol, to: entry.sol }
    rows.push(row)
    runs.set(key, row)
  }
  return rows.reverse().sort((a, b) => b.to - a.to)
}

// Newest first. The latest sol is highlighted so it is clear what just
// happened after pressing Advance. Quiet sols add nothing, so an empty log
// can mean the mission has not started or only that nothing has happened.
export function MissionLog({ log, started }: { log: GameEvent[]; started: boolean }) {
  const rows = logRows(log).slice(0, 15)
  const latestSol = rows[0]?.to
  return (
    <section aria-label="Mission log" className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-300">
        <ScrollText size={16} className="text-sky-300" aria-hidden /> Mission log
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          {started ? 'Nothing out of the ordinary so far.' : 'Nothing to report yet. Press Advance sol to begin.'}
        </p>
      ) : (
        <ol className="max-h-44 space-y-1 overflow-y-auto pr-1 text-sm">
          {rows.map(({ entry, from, to }, i) => {
            const recent = to === latestSol
            return (
              <li key={`${from}-${entry.kind}-${entry.message}`} className={`flex gap-2 ${recent ? 'text-slate-100' : 'text-slate-500'} ${i === 0 ? 'log-in' : ''}`}>
                <span className="w-20 shrink-0 tabular-nums text-slate-500">{from === to ? `Sol ${from}` : `Sols ${from}–${to}`}</span>
                <LogLine entry={entry} dim={!recent} />
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
export function LastSol({ game }: { game: GameState }) {
  const report = game.lastReport
  // The live region is on the page from the start of the mission and only
  // its contents change: screen readers tend to ignore a live region that
  // arrives together with its first news. Before the first sol there is
  // nothing to recap, and the briefing has the stage, so it is empty and
  // takes no space.
  if (!report) return <section aria-label="Last sol" aria-live="polite" className="sr-only" />
  const sol = report.sol
  const entries = game.log.filter((e) => e.sol === sol)
  return (
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
        <p className="sr-only">{spokenStatus(game)}</p>
      </div>
    </section>
  )
}

// The meters, as one sentence for a screen reader. Sighted players see the
// numbers change and pop after Advance; this is the same news, read out as
// part of the sol's recap.
function spokenStatus(game: GameState): string {
  const r = game.resources
  const d = game.lastReport!.resourceDeltas
  const change = (x: number) => {
    const n = Math.round(x)
    return n === 0 ? 'steady' : n > 0 ? `up ${n}` : `down ${-n}`
  }
  const worst = game.crew.reduce((a, b) => (b.doseMSv / b.careerDoseLimitMSv > a.doseMSv / a.careerDoseLimitMSv ? b : a))
  const earned = game.lastReport!.scienceEarned
  return (
    `Now: power ${Math.round(r.storedPowerKWh)} kWh, ${change(d.storedPowerKWh)}. ` +
    `Oxygen ${Math.round(r.oxygenKg)} kg, ${change(d.oxygenKg)}. ` +
    `Water ${Math.round(r.waterL)} litres, ${change(d.waterL)}. ` +
    `Food ${Math.round(r.foodKg)} kg, ${change(d.foodKg)}. ` +
    `Highest radiation dose: ${worst.name}, ${Math.round(worst.doseMSv)} of ${worst.careerDoseLimitMSv} mSv. ` +
    `Science ${game.sciencePoints} of ${game.scenario.scienceTarget}${earned ? `, up ${earned}` : ''}.`
  )
}
