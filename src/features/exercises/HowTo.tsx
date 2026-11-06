import { useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { useExerciseInstructions } from './api'

interface Target {
  id: string
  name: string
  imagePath: string | null | undefined
}

/** The numbered steps. Fetches on mount, so render it only when it is shown. */
export function HowToSteps({ exerciseId }: { exerciseId: string }) {
  const q = useExerciseInstructions(exerciseId, true)

  if (q.isPending) return <p className="muted">Loading instructions…</p>
  if (q.error)
    return (
      <div role="alert" className="error stack">
        <p>Could not load the instructions: {q.error.message}</p>
        <button className="btn small" onClick={() => q.refetch()}>
          Try again
        </button>
      </div>
    )
  if (q.data.length === 0) return <p className="muted">No instructions for this exercise.</p>

  return (
    <>
      {/* Numbered because the steps really are a sequence. */}
      <ol className="how-to-steps">
        {q.data.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="muted small-text">
        Instructions from{' '}
        <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">
          free-exercise-db
        </a>
        .
      </p>
    </>
  )
}

/** Bottom sheet with a larger photo and the steps. */
export function HowToSheet({
  exercise,
  onClose,
}: {
  exercise: Target | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!exercise} onClose={onClose} title={exercise ? `How to: ${exercise.name}` : ''}>
      {exercise && (
        <div className="stack how-to">
          <ExerciseThumb imagePath={exercise.imagePath} name={exercise.name} size={200} />
          <HowToSteps exerciseId={exercise.id} />
        </div>
      )}
    </Dialog>
  )
}

/** ⓘ button + sheet in one, for places that only need "open the how-to". */
export function HowToButton({ exercise }: { exercise: Target }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="icon-btn"
        aria-label={`How to do ${exercise.name}`}
        title="How to"
        onClick={() => setOpen(true)}
      >
        <InfoIcon />
      </button>
      <HowToSheet exercise={open ? exercise : null} onClose={() => setOpen(false)} />
    </>
  )
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="11" y="10.5" width="2" height="6.5" rx="1" fill="currentColor" />
      <circle cx="12" cy="7.6" r="1.25" fill="currentColor" />
    </svg>
  )
}
