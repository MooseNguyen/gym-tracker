import { Link } from 'react-router'
import type { WorkoutDraft } from './draft'
import { formatDuration, useNow } from './useNow'

/**
 * The workout in progress, docked above the tab bar on every page except the
 * workout itself, so it is one tap away from anywhere. Shows the running rest
 * countdown when there is one, otherwise the time since the start.
 */
export function LiveWorkoutBar({ draft }: { draft: WorkoutDraft }) {
  const now = useNow(1000)
  const editing = draft.mode === 'edit'
  const restLeft = draft.restEndsAt ? Math.ceil((draft.restEndsAt - now) / 1000) : 0
  const resting = restLeft > 0

  let status: string
  if (editing) status = 'Editing'
  else if (resting) status = `Rest ${formatDuration(restLeft)}`
  else status = formatDuration(Math.floor((now - Date.parse(draft.startedAt)) / 1000))

  return (
    <Link
      to="/workout"
      viewTransition
      className="livebar"
      aria-label={`${editing ? 'Continue editing' : 'Resume workout'}: ${draft.name}, ${status}`}
    >
      <span className="resume-dot" aria-hidden="true" />
      <span className="livebar-text">
        <strong>{editing ? 'Continue editing' : 'Workout in progress'}</strong>
        <span className="muted">{draft.name}</span>
      </span>
      <span className={resting ? 'livebar-time resting' : 'livebar-time'}>{status}</span>
    </Link>
  )
}
