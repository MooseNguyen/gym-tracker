import { useLayoutEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router'
import { useWorkoutDays } from '../history/api'
import { countThisWeek, dayKey, stripDays, workoutsByDay } from './calendar'

const WEEKS = 4
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' })
const fullDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

/**
 * Horizontal strip of the last 4 weeks (Mon–Sun), scrolled to today.
 * Training days are filled; a day with one workout opens it, a day with
 * several opens the history list.
 */
export function WeekStrip() {
  // One "today" per mount: the strip does not need to roll over at midnight.
  const today = useMemo(() => new Date(), [])
  const days = useMemo(() => stripDays(today, WEEKS), [today])
  const q = useWorkoutDays(days[0])
  const byDay = useMemo(() => workoutsByDay(q.data ?? []), [q.data])
  const todayKey = dayKey(today)
  const thisWeek = countThisWeek(byDay, today)

  const todayRef = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    // Instant, not smooth: the strip should simply open on today.
    todayRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [])

  return (
    <section className="week-strip" aria-labelledby="week-strip-title">
      <div className="row between">
        <h2 id="week-strip-title" className="week-strip-title">
          This week
        </h2>
        <span className="muted small-text" aria-live="polite">
          {q.isPending
            ? 'Loading…'
            : q.error
              ? 'Could not load your training days'
              : `${thisWeek} workout${thisWeek === 1 ? '' : 's'}`}
        </span>
      </div>
      <ol className="week-days">
        {days.map((d) => {
          const key = dayKey(d)
          const ids = byDay.get(key) ?? []
          const isToday = key === todayKey
          const isFuture = key > todayKey
          const cls = ['day', isToday && 'today', ids.length > 0 && 'trained', isFuture && 'future']
            .filter(Boolean)
            .join(' ')
          const label = `${fullDate.format(d)}${isToday ? ', today' : ''}${
            ids.length ? `, ${ids.length} workout${ids.length === 1 ? '' : 's'}` : ''
          }`
          const face = (
            <>
              <span className="day-name" aria-hidden="true">
                {weekday.format(d)}
              </span>
              <span className="day-num" aria-hidden="true">
                {d.getDate()}
              </span>
            </>
          )
          return (
            <li
              key={key}
              ref={isToday ? todayRef : undefined}
              className={d.getDay() === 1 ? 'week-start' : undefined}
            >
              {ids.length > 0 ? (
                <Link
                  className={cls}
                  to={ids.length === 1 ? `/history/${ids[0]}` : '/history'}
                  aria-label={label}
                  aria-current={isToday ? 'date' : undefined}
                >
                  {face}
                </Link>
              ) : (
                <span
                  className={cls}
                  aria-label={label}
                  role="img"
                  aria-current={isToday ? 'date' : undefined}
                >
                  {face}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
