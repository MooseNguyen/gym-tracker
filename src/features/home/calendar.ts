// Date helpers for the home week strip. All in the phone's local time: a
// workout at 23:30 belongs to that evening's day, not to UTC's next day.

/** Local calendar date as "YYYY-MM-DD" (sortable, usable as a map key). */
export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Monday 00:00 (local) of the week containing `d`. Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const offset = (start.getDay() + 6) % 7 // Mon = 0 … Sun = 6
  start.setDate(start.getDate() - offset)
  return start
}

/**
 * Every day of the last `weeks` weeks, Monday of the oldest week through
 * Sunday of the current one. Built with setDate (not +24h steps), so a
 * daylight-saving change can never skip or repeat a day.
 */
export function stripDays(today: Date, weeks = 4): Date[] {
  const first = startOfWeek(today)
  first.setDate(first.getDate() - 7 * (weeks - 1))
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(first)
    d.setDate(first.getDate() + i)
    return d
  })
}

/** Workout ids per local day. */
export function workoutsByDay(workouts: { id: string; started_at: string }[]) {
  const map = new Map<string, string[]>()
  for (const w of workouts) {
    const key = dayKey(new Date(w.started_at))
    map.set(key, [...(map.get(key) ?? []), w.id])
  }
  return map
}

/** How many workouts fall in the current week (Mon–Sun) of `today`. */
export function countThisWeek(byDay: Map<string, string[]>, today: Date): number {
  const start = startOfWeek(today)
  let n = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    n += byDay.get(dayKey(d))?.length ?? 0
  }
  return n
}
