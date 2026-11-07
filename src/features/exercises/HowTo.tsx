import { useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { useExerciseInstructions } from './api'

interface Target {
  id: string
  name: string
  imagePath: string | null | undefined
  /** End-of-movement photo: with it, the sheet alternates the two. */
  imagePathEnd?: string | null
}

/** Built-ins from RepDB carry its file names; older ones came from free-exercise-db. */
const fromRepdb = (imagePath: string | null | undefined) => !!imagePath?.startsWith('repdb-')

/**
 * The numbered steps. Fetches on mount, so render it only when it is shown.
 * `imagePath` picks the credit line (RepDB requires a visible one).
 */
export function HowToSteps({
  exerciseId,
  imagePath,
}: {
  exerciseId: string
  imagePath?: string | null
}) {
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
      {fromRepdb(imagePath) ? (
        <p className="muted small-text">
          Exercise data by{' '}
          <a href="https://repdb.co" target="_blank" rel="noreferrer">
            RepDB (repdb.co)
          </a>
          .
        </p>
      ) : (
        <p className="muted small-text">
          Instructions from{' '}
          <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer">
            free-exercise-db
          </a>
          .
        </p>
      )}
    </>
  )
}

/**
 * Start and end of the movement, cross-fading in a loop: enough to see the
 * direction of the lift. One photo when there is no second one; reduced
 * motion shows the start only (the animation is switched off in CSS).
 */
function HowToImage({ exercise }: { exercise: Target }) {
  if (!exercise.imagePathEnd)
    return <ExerciseThumb imagePath={exercise.imagePath} name={exercise.name} size={200} />
  return (
    <div className="how-to-frames" role="img" aria-label={`${exercise.name}, start and end`}>
      <img src={`/exercises/${exercise.imagePath}`} alt="" />
      <img src={`/exercises/${exercise.imagePathEnd}`} alt="" className="how-to-frame-end" />
    </div>
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
          <HowToImage exercise={exercise} />
          <HowToSteps exerciseId={exercise.id} imagePath={exercise.imagePath} />
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
