import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { personalRecords, type SessionSummary } from '../../shared/calc'
import { Disclosure } from '../../shared/ui/Disclosure'
import { QueryState } from '../../shared/ui/QueryState'
import { HowToSteps } from '../exercises/HowTo'
import { formatDate } from '../history/format'
import type { Unit } from '../../shared/units'
import { useUnit } from '../settings/api'
import { useExerciseHistory } from './api'

type Metric = 'bestE1RM' | 'heaviestKg' | 'volume' | 'bestReps'

const METRIC_LABEL: Record<Metric, string> = {
  bestE1RM: 'Estimated 1RM',
  heaviestKg: 'Heaviest weight',
  volume: 'Session volume',
  bestReps: 'Most reps',
}
const metricLabel = (m: Metric, unit: Unit) =>
  m === 'bestReps' ? METRIC_LABEL[m] : `${METRIC_LABEL[m]} (${unit})`

const shortDate = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

// Default export so the route can lazy-load this page and keep Recharts out of the main bundle.
export default function ExerciseStatsPage() {
  const { id } = useParams()
  const unit = useUnit()
  const q = useExerciseHistory(id, unit)
  const kind = q.data?.exercise.kind
  const metrics: Metric[] =
    kind === 'weight_reps'
      ? ['bestE1RM', 'heaviestKg', 'volume']
      : // Bodyweight: reps first, then added weight (weighted pull-ups etc.).
        ['bestReps', 'heaviestKg']
  const [picked, setPicked] = useState<Metric | null>(null)
  const metric = picked && metrics.includes(picked) ? picked : metrics[0]

  const sessions = q.data?.sessions ?? []
  const prs = personalRecords(sessions)
  const points = sessions
    .filter((s) => s[metric] != null)
    .map((s) => ({ date: shortDate.format(new Date(s.date)), value: s[metric] as number }))

  const exercise = q.data?.exercise

  return (
    <main className="page">
      {exercise && <h1>{exercise.name}</h1>}
      {/* Above the history, so it is there even before the first session. */}
      {exercise && !exercise.user_id && (
        <Disclosure className="card how-to-card" summary={<strong>How to do it</strong>}>
          <HowToSteps exerciseId={exercise.id} imagePath={exercise.image_path} />
        </Disclosure>
      )}
      <QueryState
        isPending={q.isPending}
        error={q.error}
        onRetry={q.refetch}
        isEmpty={sessions.length === 0}
        empty={<p>No history yet. Log it in a workout and come back.</p>}
      >
        <p className="muted">
          {sessions.length} session{sessions.length === 1 ? '' : 's'}
        </p>

        {kind !== 'duration' && (
          <>
            <div className="segmented" role="group" aria-label="Chart metric">
              {metrics.map((m) => (
                <button
                  key={m}
                  className={m === metric ? 'on' : ''}
                  aria-pressed={m === metric}
                  onClick={() => setPicked(m)}
                >
                  {METRIC_LABEL[m]}
                </button>
              ))}
            </div>
            <figure className="card chart" aria-label={metricLabel(metric, unit)}>
              {points.length < 2 ? (
                <p className="muted center">Need at least 2 sessions to draw a trend.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 12 }} />
                    <YAxis
                      tick={{ fill: 'var(--muted)', fontSize: 12 }}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name={metricLabel(metric, unit)}
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </figure>
          </>
        )}

        <h2>Personal records</h2>
        <dl className="prs">
          {kind === 'weight_reps' && (
            <>
              <PrCard label="Estimated 1RM" value={prs.bestE1RM} unit={unit} />
              <PrCard label="Heaviest weight" value={prs.heaviestKg} unit={unit} />
              <PrCard label="Best session volume" value={prs.bestSessionVolume} unit={unit} />
            </>
          )}
          {kind === 'bodyweight_reps' && (
            <PrCard label="Most added weight" value={prs.heaviestKg} unit={unit} />
          )}
          {kind !== 'duration' && (
            <PrCard label="Most reps in a set" value={prs.bestReps} unit="" />
          )}
        </dl>

        <h2>Sessions</h2>
        <ul className="list">
          {[...sessions].reverse().map((s: SessionSummary & { workoutId: string }) => (
            <li key={s.workoutId}>
              <Link to={`/history/${s.workoutId}`} className="list-item">
                <span>{formatDate(s.date)}</span>
                <span className="muted">
                  {kind === 'weight_reps'
                    ? `${s.heaviestKg ?? '—'} ${unit} top · ${s.volume} ${unit}`
                    : `${s.bestReps ?? '—'} reps`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </main>
  )
}

function PrCard({
  label,
  value,
  unit,
}: {
  label: string
  value: { value: number; date: string } | null
  unit: string
}) {
  return (
    <div className="card">
      <dt className="muted">{label}</dt>
      <dd>
        <strong>{value ? `${value.value} ${unit}` : '—'}</strong>
        {value && <small className="muted"> · {formatDate(value.date)}</small>}
      </dd>
    </div>
  )
}
