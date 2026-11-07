import { useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { TimeWheel } from '../../shared/ui/TimeWheel'
import { startCountdown } from './draft'
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
