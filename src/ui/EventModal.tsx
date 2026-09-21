import { TriangleAlert } from 'lucide-react'
import type { Dispatch } from 'react'
import type { PendingEvent } from '../sim/types.ts'
import type { Action } from './gameReducer.ts'

export function EventModal({ event, dispatch }: { event: PendingEvent; dispatch: Dispatch<Action> }) {
  return (
    // A light backdrop, so the meters stay readable while the player decides.
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/35 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="event-title">
      <div className="w-full max-w-lg rounded-2xl border border-amber-400/60 bg-slate-900 p-5 shadow-2xl">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-300">
          <TriangleAlert size={14} aria-hidden /> Alert
        </p>
        <h2 id="event-title" className="mt-1 text-xl font-bold">{event.title}</h2>
        <p className="mt-2 text-slate-300">{event.description}</p>
        <div className="mt-4 space-y-2">
          {event.choices.map((ch, i) => (
            <button
              key={ch.id}
              autoFocus={i === 0}
              type="button"
              onClick={() => dispatch({ type: 'chooseEvent', choiceId: ch.id })}
              className="block w-full rounded-lg border border-slate-600 px-4 py-3 text-left hover:border-amber-300 hover:bg-amber-300/10"
            >
              {ch.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
