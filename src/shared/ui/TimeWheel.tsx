import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

const ITEM_HEIGHT = 44
const VISIBLE = 5 // odd: one centred row plus two above and below

interface Props {
  values: number[]
  value: number
  onChange: (value: number) => void
  format: (value: number) => string
  /** Screen reader text for a value, e.g. "1 min 30 s". */
  spoken: (value: number) => string
  label: string
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * iOS-style picker wheel: a native scroll container with scroll-snap (so a
 * flick has real momentum on a phone), rows that shrink, fade and tilt away
 * from the centre, and a highlighted centre band. One focusable spinbutton:
 * arrow keys, Home / End, Page Up / Down.
 */
export function TimeWheel({ values, value, onChange, format, spoken, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const indexOf = (v: number) => Math.max(0, values.indexOf(v))
  // Fractional scroll position in rows, for the 3D look while it moves.
  const [pos, setPos] = useState(() => indexOf(value))
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const frame = useRef(0)

  // Open on the current value without animating.
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = indexOf(value) * ITEM_HEIGHT
    // Only on mount: afterwards the wheel itself drives the value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () => () => {
      clearTimeout(settle.current)
      cancelAnimationFrame(frame.current)
    },
    [],
  )

  const pick = (i: number) => {
    const clamped = Math.min(values.length - 1, Math.max(0, i))
    if (values[clamped] !== value) onChange(values[clamped])
    return clamped
  }

  const scrollToIndex = (i: number) => {
    const el = ref.current
    if (!el) return
    el.scrollTo({ top: i * ITEM_HEIGHT, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  function onScroll() {
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setPos(el.scrollTop / ITEM_HEIGHT))
    // The value follows once the wheel comes to rest (snap included).
    clearTimeout(settle.current)
    settle.current = setTimeout(() => pick(Math.round(el.scrollTop / ITEM_HEIGHT)), 120)
  }

  function onKeyDown(e: KeyboardEvent) {
    const current = indexOf(value)
    const moves: Record<string, number> = {
      ArrowUp: current - 1,
      ArrowDown: current + 1,
      PageUp: current - 4,
      PageDown: current + 4,
      Home: 0,
      End: values.length - 1,
    }
    if (!(e.key in moves)) return
    e.preventDefault()
    scrollToIndex(pick(moves[e.key]))
  }

  return (
    <div className="time-wheel" style={{ height: ITEM_HEIGHT * VISIBLE }}>
      <div className="time-wheel-band" aria-hidden="true" style={{ height: ITEM_HEIGHT }} />
      <div
        ref={ref}
        className="time-wheel-scroll"
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={values[0]}
        aria-valuemax={values.at(-1)}
        aria-valuenow={value}
        aria-valuetext={spoken(value)}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        style={{ paddingBlock: ITEM_HEIGHT * ((VISIBLE - 1) / 2) }}
      >
        {values.map((v, i) => {
          const offset = i - pos
          const d = Math.min(Math.abs(offset), 3)
          return (
            <div
              key={v}
              className={v === value ? 'time-wheel-item on' : 'time-wheel-item'}
              aria-hidden="true"
              style={{
                height: ITEM_HEIGHT,
                opacity: 1 - d * 0.3,
                transform: `perspective(300px) rotateX(${Math.max(-60, Math.min(60, -offset * 20))}deg) scale(${1 - d * 0.1})`,
              }}
              onClick={() => scrollToIndex(pick(i))}
            >
              {format(v)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
