import { describe, expect, it } from 'vitest'
import type { Workout } from '../../types/db'
import { csvField, workoutsToCsv } from './csv'

const set = (position: number, weight_kg: number | null, reps: number | null, extra = {}) => ({
  id: `s${position}`,
  position,
  set_type: 'normal' as const,
  weight_kg,
  reps,
  duration_s: null,
  rpe: null,
  ...extra,
})

const workout = (
  id: string,
  startedAt: string,
  name: string,
  exercises: Workout['workout_exercises'],
): Workout => ({
  id,
  routine_id: null,
  name,
  started_at: startedAt,
  ended_at: startedAt,
  notes: null,
  workout_exercises: exercises,
})

const exercise = (name: string) =>
  ({
    id: name,
    user_id: null,
    name,
    muscle_group: 'chest',
    equipment: 'barbell',
    kind: 'weight_reps',
  }) as never

const lines = (csv: string) =>
  csv
    .replace(/^\uFEFF/, '')
    .trimEnd()
    .split('\r\n')

describe('csvField', () => {
  it('quotes only when needed, doubling quotes', () => {
    expect(csvField('Bench Press')).toBe('Bench Press')
    expect(csvField('Push, heavy')).toBe('"Push, heavy"')
    expect(csvField('The "big" day')).toBe('"The ""big"" day"')
    expect(csvField('line 1\nline 2')).toBe('"line 1\nline 2"')
    expect(csvField(null)).toBe('')
    expect(csvField(82.5)).toBe('82.5')
  })

  it('keeps a typed name from running as a spreadsheet formula', () => {
    expect(csvField('=HYPERLINK("http://x","y")')).toBe('"\'=HYPERLINK(""http://x"",""y"")"')
    expect(csvField('+1 rep')).toBe("'+1 rep")
    expect(csvField('-')).toBe("'-")
    expect(csvField('@home')).toBe("'@home")
  })
})

describe('workoutsToCsv', () => {
  const ws = [
    workout('w2', '2026-11-07T10:00:00', 'Pull', [
      {
        id: 'we3',
        exercise_id: 'row',
        position: 0,
        notes: null,
        exercise: exercise('Row'),
        sets: [set(0, 60, 10)],
      },
    ]),
    workout('w1', '2026-11-05T18:30:00', 'Push', [
      // Out of order on purpose: rows follow position, not array order.
      {
        id: 'we2',
        exercise_id: 'ohp',
        position: 1,
        notes: null,
        exercise: exercise('OHP'),
        sets: [set(0, 40, 8)],
      },
      {
        id: 'we1',
        exercise_id: 'bench',
        position: 0,
        notes: 'elbows in',
        exercise: exercise('Bench Press'),
        sets: [set(1, 82.5, 5, { rpe: 8 }), set(0, 20, 10, { set_type: 'warmup' })],
      },
    ]),
  ]

  it('one row per set, oldest workout first, in the order they were done', () => {
    expect(lines(workoutsToCsv(ws, 'kg'))).toEqual([
      'Date,Time,Workout,Exercise,Set,Set type,Weight (kg),Reps,Seconds,RPE,Exercise notes,Workout notes',
      '2026-11-05,18:30,Push,Bench Press,1,warmup,20,10,,,elbows in,',
      '2026-11-05,18:30,Push,Bench Press,2,normal,82.5,5,,8,elbows in,',
      '2026-11-05,18:30,Push,OHP,1,normal,40,8,,,,',
      '2026-11-07,10:00,Pull,Row,1,normal,60,10,,,,',
    ])
  })

  it('writes weights in the chosen unit', () => {
    const rows = lines(workoutsToCsv(ws, 'lb'))
    expect(rows[0]).toContain('Weight (lb)')
    expect(rows[2]).toContain(',181.9,') // 82.5 kg
  })

  it('starts with a BOM and uses CRLF, so Excel opens it as UTF-8 rows', () => {
    const csv = workoutsToCsv(ws, 'kg')
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(6) // header + 4 rows + final newline
  })

  it('is just the header with no workouts', () => {
    expect(lines(workoutsToCsv([], 'kg'))).toHaveLength(1)
  })
})
