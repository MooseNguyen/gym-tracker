import type { Workout } from '../../types/db'
import { fromKgOrNull, type Unit } from '../../shared/units'

/**
 * Text a spreadsheet would run as a formula (=, +, -, @, and tab/CR that some
 * apps strip first) gets a leading apostrophe. A workout or exercise name is
 * typed by the user, and "=HYPERLINK(...)" in a cell is CSV injection.
 */
function neutralize(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

/** One CSV field (RFC 4180): quoted when it holds a comma, quote or line break. */
export function csvField(value: string | number | null | undefined): string {
  if (value == null) return ''
  const text = typeof value === 'number' ? String(value) : neutralize(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const pad = (n: number) => String(n).padStart(2, '0')
/** Local date and time, as the lifter saw them: "2026-11-07", "17:05". */
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/**
 * Every set as one row, oldest workout first, weights in the account's unit.
 * Starts with a BOM so Excel reads non-ASCII names (Vietnamese, ×) as UTF-8;
 * CRLF line ends as RFC 4180 says.
 */
export function workoutsToCsv(workouts: Workout[], unit: Unit): string {
  const header = [
    'Date',
    'Time',
    'Workout',
    'Exercise',
    'Set',
    'Set type',
    `Weight (${unit})`,
    'Reps',
    'Seconds',
    'RPE',
    'Exercise notes',
    'Workout notes',
  ]
  const rows: (string | number | null)[][] = []
  const ordered = [...workouts].sort((a, b) => a.started_at.localeCompare(b.started_at))
  for (const w of ordered) {
    const start = new Date(w.started_at)
    for (const we of [...w.workout_exercises].sort((a, b) => a.position - b.position)) {
      const sets = [...we.sets].sort((a, b) => a.position - b.position)
      sets.forEach((s, i) => {
        rows.push([
          localDate(start),
          localTime(start),
          w.name,
          we.exercise.name,
          i + 1,
          s.set_type,
          fromKgOrNull(s.weight_kg, unit),
          s.reps,
          s.duration_s,
          s.rpe,
          we.notes,
          w.notes,
        ])
      })
    }
  }
  return '\uFEFF' + [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n'
}

/**
 * Hands the file to the user: the share sheet on a phone (an installed iOS
 * web app can't download a blob link), a normal download elsewhere.
 * Must run inside the tap's handler, or Safari refuses to share.
 */
export async function saveFile(file: File): Promise<'saved' | 'cancelled'> {
  const phone = window.matchMedia('(pointer: coarse)').matches
  if (phone && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'saved'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Anything else: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  // After the click has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'saved'
}
