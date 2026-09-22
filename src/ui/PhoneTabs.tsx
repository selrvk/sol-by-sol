import { ChartLine, ClipboardList, Map, type LucideIcon } from 'lucide-react'

// Which group of panels a phone is showing. The meters and the crew stay
// together in one pane on purpose: choosing between a shift of repairs and
// a shift of science is the whole game, and you cannot weigh that if the
// two halves live on different screens.
export type Pane = 'base' | 'mission' | 'trends'

export type Attention = 'warn' | 'bad'

const TABS: { id: Pane; label: string; icon: LucideIcon }[] = [
  { id: 'base', label: 'Base', icon: Map },
  { id: 'mission', label: 'Mission', icon: ClipboardList },
  { id: 'trends', label: 'Trends', icon: ChartLine },
]

// A dot on a tab you are not looking at, so nothing important can happen
// out of sight. This is what a long scroll could not do: there, a warning
// two screens down was simply missed.
export function PhoneTabs({
  pane,
  onChange,
  attention,
}: {
  pane: Pane
  onChange: (p: Pane) => void
  attention: Partial<Record<Pane, Attention>>
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900 p-1" role="group" aria-label="Sections">
      {TABS.map(({ id, label, icon: Icon }) => {
        const active = pane === id
        const alert = attention[id]
        return (
          <button
            key={id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(id)}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold transition active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 ${
              active ? 'bg-slate-700 text-white' : 'text-slate-400'
            }`}
          >
            <Icon size={16} aria-hidden /> {label}
            {alert && (
              <span className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${alert === 'bad' ? 'bg-red-400' : 'bg-amber-300'}`}>
                <span className="sr-only">needs attention</span>
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
