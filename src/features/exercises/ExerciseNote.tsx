import { useId, useState } from 'react'
import { Dialog } from '../../shared/ui/Dialog'
import { MAX_NOTE_LENGTH, normalizeNote } from './noteText'
import { useExerciseNote, useNoteSaveState, useSaveExerciseNote } from './notesApi'

interface NoteTarget {
  exerciseId: string
  name: string
}

/**
 * Text box with Save and Remove. Saving updates the screen at once (see
 * useSaveExerciseNote), so it calls onDone right away; how the save went
 * shows next to the note (NoteSaveStatus).
 */
export function ExerciseNoteEditor({
  exerciseId,
  name,
  onDone,
  onCancel,
}: NoteTarget & { onDone: () => void; onCancel?: () => void }) {
  const current = useExerciseNote(exerciseId)
  const save = useSaveExerciseNote(exerciseId)
  const [text, setText] = useState(current ?? '')
  const id = useId()
  const next = normalizeNote(text)
  const unchanged = next === (current ?? null)

  const submit = (note: string | null) => {
    save.mutate(note)
    onDone()
  }

  return (
    <form
      className="stack note-editor"
      onSubmit={(e) => {
        e.preventDefault()
        if (!unchanged) submit(next)
      }}
    >
      <label className="muted" htmlFor={id}>
        Note for {name}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        placeholder="e.g. seat on 4, wide grip"
        aria-describedby={`${id}-hint`}
        // The editor only opens on purpose: ready to type.
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <p id={`${id}-hint`} className="muted small-text note-hint">
        <span>Shown every time this exercise comes up.</span>
        <span aria-live="polite">
          {text.length}/{MAX_NOTE_LENGTH}
        </span>
      </p>
      <button type="submit" className="btn primary block" disabled={unchanged}>
        Save
      </button>
      {current !== undefined && (
        <button type="button" className="btn block danger" onClick={() => submit(null)}>
          Remove note
        </button>
      )}
      {onCancel && (
        <button type="button" className="btn block" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  )
}

/** The editor in its own sheet, for the exercise card. */
export function ExerciseNoteSheet({
  target,
  onClose,
}: {
  target: NoteTarget | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!target} onClose={onClose} title="Exercise note">
      {/* Mounted per opening: the text starts from the saved note each time. */}
      {target && <ExerciseNoteEditor {...target} onDone={onClose} />}
    </Dialog>
  )
}

/** "Saves when back online" / "Not saved, Retry" under a note. */
export function NoteSaveStatus({ exerciseId, name }: NoteTarget) {
  const state = useNoteSaveState(exerciseId)
  const save = useSaveExerciseNote(exerciseId)
  if (state.status === 'waiting')
    return <p className="muted small-text">No signal: the note saves when you're back online.</p>
  if (state.status === 'failed')
    return (
      <p role="alert" className="error note-status">
        The note for {name} was not saved.{' '}
        <button type="button" className="btn small" onClick={() => save.mutate(state.note)}>
          Retry
        </button>
      </p>
    )
  return null
}

/**
 * On the exercise card: the note (tap to edit) and how its save went. Nothing
 * when there is no note: the "Pin note" chip adds one.
 */
export function CardNote({ exerciseId, name, onEdit }: NoteTarget & { onEdit: () => void }) {
  const note = useExerciseNote(exerciseId)
  return (
    <>
      {note !== undefined && (
        <button
          type="button"
          className="card-note"
          aria-label={`Note for ${name}: ${note}. Edit`}
          aria-haspopup="dialog"
          onClick={onEdit}
        >
          <span aria-hidden="true">📌</span>
          <span className="card-note-text">{note}</span>
        </button>
      )}
      <NoteSaveStatus exerciseId={exerciseId} name={name} />
    </>
  )
}

/** In the How-to sheet: the note, edited in place (no sheet on a sheet). */
export function HowToNote({ exerciseId, name }: NoteTarget) {
  const note = useExerciseNote(exerciseId)
  const [editing, setEditing] = useState(false)

  if (editing)
    return (
      <ExerciseNoteEditor
        exerciseId={exerciseId}
        name={name}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    )
  return (
    <section className="stack how-to-note" aria-label="Your note">
      {note !== undefined ? (
        <p className="card-note-text">
          <span aria-hidden="true">📌 </span>
          {note}
        </p>
      ) : (
        <p className="muted">No note yet: set-up details you want every time.</p>
      )}
      <NoteSaveStatus exerciseId={exerciseId} name={name} />
      <button type="button" className="btn small" onClick={() => setEditing(true)}>
        {note !== undefined ? 'Edit note' : 'Add a note'}
      </button>
    </section>
  )
}
