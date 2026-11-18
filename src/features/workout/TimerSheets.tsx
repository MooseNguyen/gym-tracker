import { useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { TimeWheel } from '../../shared/ui/TimeWheel'
import {
  clearDuration,
  durationSeconds,
  maxDurationSeconds,
  MIN_DURATION_S,
  setDuration,
  startCountdown,
} from './draft'
import { setDraft, useDraft } from './draftStore'
import {
  formatStopwatch,
  pauseStopwatch,
  spokenSeconds,
  startStopwatch,
  STOPPED,
  stopwatchElapsed,
  wheelSteps,
} from './timers'
import { formatDuration, useNow } from './useNow'

const wheelLabel = (sec: number) => (sec === 0 ? 'Off' : formatDuration(sec))

/** Rest time of one exercise, picked on a wheel; Done applies it. */
export function RestPickerSheet({
  exerciseName,
  value,
  open,
  onDone,
  onClose,
}: {
  exerciseName: string
  value: number
  open: boolean
  onDone: (seconds: number) => void
  onClose: () => void
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Rest timer">
      <RestPickerBody exerciseName={exerciseName} value={value} onDone={onDone} />
    </Dialog>
  )
}

// Own component: the pending value resets each time the sheet opens.
function RestPickerBody({
  exerciseName,
  value,
  onDone,
}: {
  exerciseName: string
  value: number
  onDone: (seconds: number) => void
}) {
  const [pending, setPending] = useState(value)
  return (
    <div className="stack timer-sheet">
      <p className="muted center">{exerciseName}</p>
      <TimeWheel
        values={wheelSteps(value)}
        value={pending}
        onChange={setPending}
        format={wheelLabel}
        spoken={spokenSeconds}
        label={`Rest time for ${exerciseName}`}
      />
      <button type="button" className="btn primary block" onClick={() => onDone(pending)}>
        Done
      </button>
    </div>
  )
}

/** The header ⏱: a countdown (shown in the floating timer) and a free stopwatch. */
export function TimerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Timer">
      <TimerBody onStarted={onClose} />
    </Dialog>
  )
}

function TimerBody({ onStarted }: { onStarted: () => void }) {
  const [tab, setTab] = useState<'countdown' | 'stopwatch'>('countdown')
  const [seconds, setSeconds] = useState(60)

  return (
    <div className="stack timer-sheet">
      <div className="segmented" role="tablist" aria-label="Timer type">
        {(['countdown', 'stopwatch'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'on' : ''}
            onClick={() => setTab(t)}
          >
            {t === 'countdown' ? 'Countdown' : 'Stopwatch'}
          </button>
        ))}
      </div>

      {tab === 'countdown' ? (
        <div className="stack" role="tabpanel" aria-label="Countdown">
          <TimeWheel
            values={wheelSteps().filter((s) => s > 0)}
            value={seconds}
            onChange={setSeconds}
            format={wheelLabel}
            spoken={spokenSeconds}
            label="Countdown length"
          />
          <button
            type="button"
            className="btn primary block"
            onClick={() => {
              setDraft((d) => startCountdown(d, seconds))
              onStarted()
            }}
          >
            Start {formatDuration(seconds)}
          </button>
        </div>
      ) : (
        <StopwatchPanel />
      )}
    </div>
  )
}

function StopwatchPanel() {
  const sw = useDraft()?.stopwatch ?? STOPPED
  const running = sw.startedAt != null
  const now = useNow(100, running)
  const elapsed = stopwatchElapsed(sw, now)
  const update = (fn: typeof startStopwatch) =>
    setDraft((d) => ({ ...d, stopwatch: fn(d.stopwatch ?? STOPPED, Date.now()) }))

  return (
    <div className="stack" role="tabpanel" aria-label="Stopwatch">
      <p className={running ? 'stopwatch-time running' : 'stopwatch-time'} role="timer">
        {formatStopwatch(elapsed)}
      </p>
      <div className="row">
        <button
          type="button"
          className="btn"
          disabled={elapsed === 0 && !running}
          onClick={() => setDraft((d) => ({ ...d, stopwatch: STOPPED }))}
        >
          Reset
        </button>
        <button
          type="button"
          className="btn primary grow"
          onClick={() => update(running ? pauseStopwatch : startStopwatch)}
        >
          {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </button>
      </div>
    </div>
  )
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 60 }, (_, m) => m)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Hours and minutes of the workout; Save sets the end to start + that. */
export function DurationSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Duration">
      <DurationBody onDone={onClose} />
    </Dialog>
  )
}

// Own component: the wheels start from the current duration each time the sheet opens.
function DurationBody({ onDone }: { onDone: () => void }) {
  const draft = useDraft()
  const [opened] = useState(() => Date.now())
  const current = draft ? durationSeconds(draft, opened) : 0
  const [hours, setHours] = useState(() => Math.min(23, Math.floor(current / 3600)))
  const [minutes, setMinutes] = useState(() => Math.floor((current % 3600) / 60))
  if (!draft) return null

  const chosen = hours * 3600 + minutes * 60
  const max = maxDurationSeconds(draft, opened)
  const problem =
    chosen < MIN_DURATION_S
      ? 'At least 1 minute.'
      : chosen > max
        ? `At most ${formatHoursMinutes(max)}: the time since the workout started.`
        : null

  return (
    <div className="stack timer-sheet">
      <p className="muted center">The start stays; the end moves.</p>
      <div className="duration-wheels">
        <TimeWheel
          values={HOURS}
          value={hours}
          onChange={setHours}
          format={(h) => `${h} h`}
          spoken={(h) => plural(h, 'hour')}
          label="Hours"
        />
        <TimeWheel
          values={MINUTES}
          value={minutes}
          onChange={setMinutes}
          format={(m) => `${m} min`}
          spoken={(m) => plural(m, 'minute')}
          label="Minutes"
        />
      </div>
      {problem && (
        <p role="alert" className="error center">
          {problem}
        </p>
      )}
      <button
        type="button"
        className="btn primary block"
        disabled={problem != null}
        onClick={() => {
          setDraft((d) => setDuration(d, chosen))
          onDone()
        }}
      >
        Save
      </button>
      {draft.mode === 'new' && draft.endedAt && (
        <button
          type="button"
          className="btn block"
          onClick={() => {
            setDraft(clearDuration)
            onDone()
          }}
        >
          Use live time
        </button>
      )}
    </div>
  )
}

/** "1 h 10 min", "45 min". */
function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}
