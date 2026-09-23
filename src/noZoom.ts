// Page zoom is switched off, at the team's request. This is a trade-off:
// WCAG 1.4.4 asks that text can be enlarged to 200%, and some players need
// that. Everything is in this file and the viewport tag in index.html, so
// turning zoom back on is: delete this file, its import in main.tsx, and
// `maximum-scale=1, user-scalable=no` from index.html.
//
// What each part stops:
// - Android Chrome pinch: the viewport tag in index.html.
// - iOS Safari ignores that tag, so pinch is stopped at Safari's own
//   gesture events (which macOS Safari also sends for a trackpad pinch),
//   and double-tap zoom by touch-action: manipulation, which keeps
//   ordinary scrolling and taps.
// - Desktop: Ctrl/Cmd + mouse wheel (also how a trackpad pinch arrives in
//   Chrome, Edge and Firefox) and Ctrl/Cmd + plus, minus or 0.
// What no page can stop: zoom from the browser's own menu or settings.

const ZOOM_KEYS = new Set(['+', '=', '-', '_', '0'])

export function blockZoom(): void {
  document.documentElement.style.touchAction = 'manipulation'

  const stop = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', stop)
  document.addEventListener('gesturechange', stop)

  // Listeners on the document are passive by default in Chrome, and a
  // passive listener cannot cancel the wheel.
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    },
    { passive: false },
  )
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.has(e.key)) e.preventDefault()
  })
}
