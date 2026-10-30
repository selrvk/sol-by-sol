import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'

// The game's own "are you sure?", in place of the browser's confirm box,
// which looked like an error from the website rather than a question from
// the game. The safe answer comes first and has the focus, so a stray Enter
// keeps the mission; Escape or a click outside the card does the same. The
// focus goes back to whatever opened it when it closes.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  // The latest handler, so the setup below runs once however often the
  // dialog is drawn.
  const cancelNow = useRef(onCancel)
  useEffect(() => {
    cancelNow.current = onCancel
  })
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    cancel.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelNow.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      opener?.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-body"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="end-in w-full max-w-md rounded-2xl border border-slate-600 bg-slate-900 p-5 shadow-2xl">
        <h2 id="confirm-title" className="flex items-center gap-2 text-lg font-bold">
          <TriangleAlert size={20} className="shrink-0 text-amber-300" aria-hidden /> {title}
        </h2>
        <p id="confirm-body" className="mt-2 text-sm text-slate-300">
          {body}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {confirmLabel}
          </button>
          <button
            ref={cancel}
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-yellow-300 px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-yellow-200 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
