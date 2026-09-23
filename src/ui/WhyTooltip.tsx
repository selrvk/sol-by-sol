import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { CONSTANTS, CURVES, type SourcedConstant, type SourcedCurve } from '../sim/constants.ts'
import { SOURCE_LABELS, type MeterWhy, type WhyRef } from './labels.ts'

// "why?" button that reveals the real figures behind a meter and their
// sources. Placeholders are labelled as estimates, never as fact.
//
// The source lists are long -- the radiation one is taller than a phone --
// so on a phone this opens as a sheet from the bottom, the same shape as the
// crew task picker, where it has the room to be read and scrolled. A wide
// screen keeps the popover next to the meter it explains.
export function WhyTooltip({ why }: { why: MeterWhy }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  // Desktop only: which side of the button has room, and how much. The
  // meters low in the column have a lot of screen above them and almost
  // none below, and the tallest of these panels is taller than a laptop, so
  // a popover that always drops downwards runs off the bottom of the screen.
  const [place, setPlace] = useState<{ above: boolean; maxH: number } | null>(null)

  useLayoutEffect(() => {
    const t = trigger.current
    if (!open || !t || !window.matchMedia('(min-width: 1024px)').matches) {
      setPlace(null)
      return
    }
    const r = t.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 12
    const above = r.top - 12
    setPlace(above > below ? { above: true, maxH: above } : { above: false, maxH: below })
  }, [open])

  // Escape closes, and so does a press anywhere outside. This used to hang
  // off the button's own onBlur, but a press inside the panel blurs the
  // button too, so scrolling a long source list dismissed it -- which made
  // the part below the fold unreachable.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <span ref={box} className="relative inline-block">
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full border border-sky-400/50 px-1.5 text-[11px] leading-4 text-sky-300 hover:bg-sky-400/10"
      >
        why?
      </button>
      {open && (
        <>
          {/* Phones get a backdrop, so the sheet reads as a layer over the
              mission rather than part of the meter. */}
          <span onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-hidden />
          <div
            role="tooltip"
            // `place` is set on wide screens only, so the phone sheet below
            // keeps its own full-width sizing.
            style={
              place
                ? place.above
                  ? { maxHeight: place.maxH, top: 'auto', bottom: '100%', marginTop: 0, marginBottom: 4 }
                  : { maxHeight: place.maxH }
                : undefined
            }
            className="fixed inset-x-0 bottom-0 z-40 max-h-[85vh] space-y-2 overflow-y-auto overscroll-contain rounded-t-2xl border-t border-slate-600 bg-slate-900 p-4 pb-6 text-left text-xs text-slate-200 shadow-xl lg:absolute lg:inset-x-auto lg:bottom-auto lg:right-0 lg:z-30 lg:mt-1 lg:max-h-[70vh] lg:w-80 lg:max-w-[85vw] lg:rounded-lg lg:border lg:p-3 lg:pb-3"
          >
            {why.rules && (
              <div className="space-y-1.5 border-b border-slate-700 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">In the game</p>
                {/* Neutral arrows: for radiation, up is the bad direction. */}
                <p className="flex gap-1.5 leading-snug">
                  <ArrowUp size={14} className="mt-px shrink-0 text-slate-300" aria-hidden />
                  <span>
                    <span className="font-semibold text-white">Goes up: </span>
                    {why.rules.up}
                  </span>
                </p>
                <p className="flex gap-1.5 leading-snug">
                  <ArrowDown size={14} className="mt-px shrink-0 text-slate-300" aria-hidden />
                  <span>
                    <span className="font-semibold text-white">Goes down: </span>
                    {why.rules.down}
                  </span>
                </p>
                {why.rules.note && <p className="text-slate-400">{why.rules.note}</p>}
              </div>
            )}
            {why.rules && <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300">For real</p>}
            <p className="text-sm leading-snug text-slate-100">{why.summary}</p>
            <div className="space-y-2 border-t border-slate-700 pt-2">
              {why.refs.map((ref, i) => (
                <WhyLine key={i} whyRef={ref} />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-600 py-2.5 text-sm font-semibold hover:border-slate-400 lg:hidden"
            >
              <X size={15} aria-hidden /> Close
            </button>
          </div>
        </>
      )}
    </span>
  )
}

function WhyLine({ whyRef }: { whyRef: WhyRef }) {
  if ('rule' in whyRef) return <p className="text-slate-300">{whyRef.rule}</p>
  const key = 'constant' in whyRef ? whyRef.constant : whyRef.curve
  const item: SourcedConstant | SourcedCurve = 'constant' in whyRef ? CONSTANTS[whyRef.constant] : CURVES[whyRef.curve]
  const figure =
    'value' in item
      ? `${item.value} ${item.unit}`
      : item.points.map(([g, d]) => `${d} at ${g} g/cm²`).join(', ') + ` (${item.unit})`
  return (
    <div>
      <p className="text-slate-400">{SOURCE_LABELS[key]}</p>
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
