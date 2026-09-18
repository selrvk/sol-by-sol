import { useState } from 'react'
import { CONSTANTS, CURVES, type SourcedConstant, type SourcedCurve } from '../sim/constants.ts'
import type { WhyRef } from './labels.ts'

// "why?" button that reveals the real figures behind a meter and their
// sources. Placeholders are labelled as estimates, never as fact.
export function WhyTooltip({ refs }: { refs: WhyRef[] }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        className="rounded-full border border-sky-400/50 px-1.5 text-[11px] leading-4 text-sky-300 hover:bg-sky-400/10"
      >
        why?
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute right-0 z-30 mt-1 w-72 space-y-2 rounded-lg border border-slate-600 bg-slate-900 p-3 text-xs text-slate-200 shadow-xl"
        >
          {refs.map((ref, i) => (
            <WhyLine key={i} whyRef={ref} />
          ))}
        </div>
      )}
    </span>
  )
}

function WhyLine({ whyRef }: { whyRef: WhyRef }) {
  if ('rule' in whyRef) return <p className="text-slate-300">{whyRef.rule}</p>
  const item: SourcedConstant | SourcedCurve = 'constant' in whyRef ? CONSTANTS[whyRef.constant] : CURVES[whyRef.curve]
  const figure =
    'value' in item
      ? `${item.value} ${item.unit}`
      : item.points.map(([g, d]) => `${d} at ${g} g/cm²`).join(', ') + ` (${item.unit})`
  return (
    <div>
      <p className="font-semibold text-white">
        {figure}
        {item.status === 'placeholder' && (
          <span className="ml-1 rounded bg-amber-500/20 px-1 text-amber-300">estimate</span>
        )}
      </p>
      {item.note && <p className="text-slate-400">{item.note}</p>}
      <p className="italic text-slate-500">Source: {item.source}</p>
    </div>
  )
}
