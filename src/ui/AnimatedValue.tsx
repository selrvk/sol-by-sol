import { useEffect, useRef, useState } from 'react'

const DURATION_MS = 650

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// A number that counts to its new value instead of jumping, so a change is
// visible after pressing Advance. Jumps straight there if the reader has
// asked for reduced motion.
export function AnimatedValue(props: { value: number; digits?: number; suffix?: string }) {
  // Readers who asked for less motion get the plain number, no state at all.
  return prefersReducedMotion() ? (
    <>
      {props.value.toFixed(props.digits ?? 0)}
      {props.suffix ?? ''}
    </>
  ) : (
    <CountingValue {...props} />
  )
}

function CountingValue({ value, digits = 0, suffix = '' }: { value: number; digits?: number; suffix?: string }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  const frame = useRef(0)

  useEffect(() => {
    const target = value
    const start = from.current
    if (start === target) return
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION_MS)
      const eased = 1 - (1 - p) ** 3
      setShown(start + (target - start) * eased)
      if (p < 1) frame.current = requestAnimationFrame(step)
      else from.current = target
    }
    frame.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame.current)
  }, [value])

  return (
    <>
      {shown.toFixed(digits)}
      {suffix}
    </>
  )
}
