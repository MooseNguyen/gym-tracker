import { useId, useState, type FormEvent } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { dayKey } from '../home/calendar'
import { useUnit } from '../settings/api'
import { useConfirm } from '../../shared/ui/confirmContext'
import { QueryState } from '../../shared/ui/QueryState'
import { formatAmount, fromKg, type Unit } from '../../shared/units'
import { useBodyWeights, useDeleteBodyWeight, useSaveBodyWeight } from './api'
import {
  change,
  checkWeighIn,
  inRange,
  parseDay,
  RANGES,
  type BodyWeight,
  type Range,
} from './bodyWeight'

const longDate = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
const formatDay = (day: string) => longDate.format(parseDay(day))
const formatWeight = (kg: number, unit: Unit) => formatAmount(fromKg(kg, unit), unit)

// Default export so the route can lazy-load this page: Recharts stays out of the main bundle.
export default function BodyWeightPage() {
  const unit = useUnit()
  const q = useBodyWeights()
  const [range, setRange] = useState<Range>('3m')
  const entries = q.data ?? []

  return (
    <main className="page">
      <h1>Body weight</h1>
      <WeighInForm unit={unit} entries={entries} />
      <QueryState
        isPending={q.isPending}
        error={q.error}
        onRetry={q.refetch}
        isEmpty={entries.length === 0}
        empty={<p>No weigh-ins yet. Log your first one above.</p>}
      >
        <div className="segmented" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              className={r.value === range ? 'on' : ''}
              aria-pressed={r.value === range}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Trend entries={inRange(entries, range, new Date())} range={range} unit={unit} />
        <WeighInList entries={entries} unit={unit} />
      </QueryState>
    </main>
  )
}

function WeighInForm({ unit, entries }: { unit: Unit; entries: BodyWeight[] }) {
  const save = useSaveBodyWeight()
  const today = dayKey(new Date())
  const [day, setDay] = useState(today)
  const [weight, setWeight] = useState('')
  const [problem, setProblem] = useState<{ field: 'weight' | 'date'; message: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const errorId = useId()
  const existing = entries.find((e) => e.measured_on === day)

  function submit(e: FormEvent) {
    e.preventDefault()
    setSaved(false)
    const check = checkWeighIn(weight, day, unit, today)
    if (!check.ok) {
      setProblem({ field: check.field, message: check.message })
      return
    }
    setProblem(null)
    save.mutate(
      { measured_on: check.measured_on, weight_kg: check.weight_kg },
      {
        onSuccess: () => {
          setWeight('')
          setSaved(true)
        },
      },
    )
  }

  const invalid = (field: 'weight' | 'date') => problem?.field === field

  return (
    <form className="card stack" onSubmit={submit} noValidate aria-label="Log a weigh-in">
      <div className="row">
        <label className="field">
          <span>Day</span>
          <input
            type="date"
            value={day}
            max={today}
            onChange={(e) => {
              setDay(e.target.value)
              setSaved(false)
            }}
            aria-invalid={invalid('date')}
            aria-describedby={invalid('date') ? errorId : undefined}
          />
        </label>
        <label className="field">
          <span>Weight ({unit})</span>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={weight}
            onChange={(e) => {
              setWeight(e.target.value)
              setSaved(false)
            }}
            aria-invalid={invalid('weight')}
            aria-describedby={invalid('weight') ? errorId : undefined}
          />
        </label>
      </div>
      {existing && (
        <p className="muted small-text">
          Replaces {formatWeight(existing.weight_kg, unit)} logged that day.
        </p>
      )}
      {problem && (
        <p id={errorId} role="alert" className="error small-text">
          {problem.message}
        </p>
      )}
      {save.error && (
        <p role="alert" className="error small-text">
          Could not save: {save.error.message}
        </p>
      )}
      <button type="submit" className="btn primary block" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save weigh-in'}
      </button>
      {saved && (
        <p role="status" className="muted small-text">
          Saved.
        </p>
      )}
    </form>
  )
}

function Trend({ entries, range, unit }: { entries: BodyWeight[]; range: Range; unit: Unit }) {
  const latest = entries.at(-1)
  const delta = change(entries)
  const label = RANGES.find((r) => r.value === range)!.label
  const points = entries.map((e) => ({
    date: shortDate.format(parseDay(e.measured_on)),
    value: fromKg(e.weight_kg, unit),
  }))

  return (
    <>
      {latest ? (
        <p>
          <strong>{formatWeight(latest.weight_kg, unit)}</strong>{' '}
          <span className="muted">on {formatDay(latest.measured_on)}</span>
          {delta != null && (
            <>
              <br />
              <span className="muted">
                {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
                {formatWeight(Math.abs(delta), unit)} {range === 'all' ? 'overall' : `in ${label}`}
              </span>
            </>
          )}
        </p>
      ) : (
        <p className="muted">No weigh-ins in this range.</p>
      )}
      <figure className="card chart" aria-label={`Body weight (${unit}), ${label}`}>
        {points.length < 2 ? (
          <p className="muted center">Need at least 2 weigh-ins in this range to draw a trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name={`Weight (${unit})`}
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </figure>
    </>
  )
}

function WeighInList({ entries, unit }: { entries: BodyWeight[]; unit: Unit }) {
  const del = useDeleteBodyWeight()
  const confirm = useConfirm()

  async function remove(e: BodyWeight) {
    const ok = await confirm({
      title: 'Delete this weigh-in?',
      message: `${formatWeight(e.weight_kg, unit)} on ${formatDay(e.measured_on)}.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) del.mutate(e.measured_on)
  }

  return (
    <section className="stack" aria-labelledby="weigh-ins-heading">
      <h2 id="weigh-ins-heading">Weigh-ins</h2>
      {del.error && (
        <p role="alert" className="error small-text">
          Could not delete: {del.error.message}
        </p>
      )}
      <ul className="list">
        {[...entries].reverse().map((e) => (
          <li key={e.measured_on} className="list-item">
            <span className="grow">{formatDay(e.measured_on)}</span>
            <strong>{formatWeight(e.weight_kg, unit)}</strong>
            <button
              type="button"
              className="btn ghost small"
              aria-label={`Delete weigh-in of ${formatDay(e.measured_on)}`}
              onClick={() => remove(e)}
              disabled={del.isPending}
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
