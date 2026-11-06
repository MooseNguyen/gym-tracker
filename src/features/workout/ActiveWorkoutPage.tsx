import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { HowToButton } from '../exercises/HowTo'
import { formatSetValues } from '../history/format'
import { Disclosure } from '../../shared/ui/Disclosure'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { DragHandle, SortableList, type HandleProps } from '../../shared/ui/SortableList'
import type { PreviousSet, SetType } from '../../types/db'
import {
  addExercises,
  addSet,
  completedSetCount,
  describeImprovement,
  improvementOver,
  nextSetType,
  removeExercise,
  removeSet,
  reorderExercises,
  requiredField,
  toSavePayload,
  toggleSetComplete,
  updateExercise,
  updateSet,
  type DraftExercise,
  type DraftSet,
} from './draft'
import { setDraft, useDraft } from './draftStore'
import { usePreviousSets, useSaveWorkout } from './api'
import { PrBanner, type Celebration } from './PrBanner'
import { playCelebration } from './celebrate'
import { RestTimer } from './RestTimer'
import { formatDuration, useNow } from './useNow'
import { useWakeLock } from './useWakeLock'

export function ActiveWorkoutPage() {
  const draft = useDraft()
  const navigate = useNavigate()
  const save = useSaveWorkout()
  const [picking, setPicking] = useState(false)
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  // View state only (not part of the draft): which exercise cards are folded.
  // A reload simply shows everything expanded again.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  // The set whose ✓ was refused because reps (or duration) are still empty.
  const [missing, setMissing] = useState<string | null>(null)
  const clearCelebration = useCallback(() => setCelebration(null), [])
  const isNew = draft?.mode === 'new'
  const now = useNow(1000, isNew)
  useWakeLock(isNew)

  const previous = usePreviousSets(
    draft?.exercises.map((e) => e.exerciseId) ?? [],
    // When editing, "previous" must mean the workout before this one.
    draft?.mode === 'edit' ? draft.id : undefined,
  )

  // Not a <Navigate>: finishing clears the draft and then navigates to the saved
  // workout. A redirect here would fire after that and send the user home instead.
  if (!draft)
    return (
      <main className="page center">
        <p className="muted">No workout in progress.</p>
        <Link className="btn primary" to="/">
          Start one
        </Link>
      </main>
    )

  const completed = completedSetCount(draft)
  const allCollapsed =
    draft.exercises.length > 0 && draft.exercises.every((e) => collapsed.has(e.id))

  function toggleDone(
    ex: DraftExercise,
    set: DraftSet,
    prev: PreviousSet | undefined,
    origin: { x: number; y: number },
  ) {
    let completedSet: DraftSet | undefined
    setDraft((d) => {
      const next = toggleSetComplete(d, ex.id, set.id, prev)
      completedSet = next.exercises.find((e) => e.id === ex.id)?.sets.find((s) => s.id === set.id)
      return next
    })
    if (!set.completed && !completedSet?.completed) {
      // Refused: point at the field to fill instead of silently doing nothing.
      setMissing(set.id)
      document.getElementById(fieldId(set.id, requiredField(ex.kind)))?.focus()
      return
    }
    setMissing(null)
    // Only when ticking on (not off), and not while editing an old workout.
    if (!isNew || set.completed || !completedSet?.completed) return
    const gain = improvementOver(completedSet, prev)
    if (!gain) return
    setCelebration({ id: Date.now(), exercise: ex.name, text: describeImprovement(gain) })
    playCelebration(origin)
  }

  function finish() {
    if (!draft) return
    if (completed === 0) {
      alert('Tick at least one set before finishing, or discard the workout.')
      return
    }
    const unfinished = draft.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => !s.completed).length,
      0,
    )
    if (
      unfinished > 0 &&
      !confirm(`${unfinished} unticked set(s) will not be saved. Finish anyway?`)
    )
      return

    save.mutate(toSavePayload(draft), {
      onSuccess: (id) => {
        setDraft(null)
        navigate(`/history/${id}`, { replace: true })
      },
    })
  }

  function discard() {
    const msg =
      draft?.mode === 'edit'
        ? 'Discard your changes?'
        : 'Discard this workout? Nothing will be saved.'
    if (!confirm(msg)) return
    setDraft(null)
    navigate(draft?.mode === 'edit' ? `/history/${draft.id}` : '/', { replace: true })
  }

  return (
    <main className="page workout">
      <header className="workout-header">
        <input
          className="title-input"
          aria-label="Workout name"
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
        <div className="workout-stats">
          <div>
            <span className="stat-label">Duration</span>
            <span className="stat-value">
              {isNew ? formatDuration((now - Date.parse(draft.startedAt)) / 1000) : 'Editing'}
            </span>
          </div>
          <div>
            <span className="stat-label">Sets done</span>
            <span className="stat-value">{completed}</span>
          </div>
        </div>
      </header>

      {previous.error && (
        <p className="muted">Could not load previous sets. Logging still works.</p>
      )}

      {draft.exercises.length === 0 && (
        <p className="muted center">Add an exercise to get started.</p>
      )}

      {draft.exercises.length > 1 && (
        <div className="row between">
          <h2>Exercises</h2>
          <button
            className="btn small"
            onClick={() =>
              setCollapsed(allCollapsed ? new Set() : new Set(draft.exercises.map((e) => e.id)))
            }
          >
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </button>
        </div>
      )}

      <div className="stack">
        <SortableList
          items={draft.exercises}
          onReorder={(from, to) => setDraft((d) => reorderExercises(d, from, to))}
          getLabel={(ex) => ex.name}
          renderItem={(ex, handle) => (
            <ExerciseCard
              ex={ex}
              handle={handle}
              previous={previous.data?.get(ex.exerciseId) ?? []}
              onToggleDone={toggleDone}
              missingSetId={missing}
              onEdited={(setId) => setMissing((m) => (m === setId ? null : m))}
              open={!collapsed.has(ex.id)}
              onOpenChange={(open) =>
                setCollapsed((prev) => {
                  const next = new Set(prev)
                  if (open) next.delete(ex.id)
                  else next.add(ex.id)
                  return next
                })
              }
            />
          )}
        />
      </div>

      <button className="btn block" onClick={() => setPicking(true)}>
        + Add exercises
      </button>

      <label className="field">
        <span>Workout notes</span>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
      </label>

      {save.error && (
        <p role="alert" className="error">
          Saving failed: {save.error.message}. Your workout is still on this phone. Try again.
        </p>
      )}

      <div className="row">
        <button className="btn danger" onClick={discard} disabled={save.isPending}>
          Discard
        </button>
        <button className="btn primary grow" onClick={finish} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : isNew ? 'Finish workout' : 'Save changes'}
        </button>
      </div>

      {isNew && draft.restEndsAt && <RestTimer endsAt={draft.restEndsAt} />}
      <PrBanner celebration={celebration} onDone={clearCelebration} />

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ex) => setDraft((d) => addExercises(d, ex))}
      />
    </main>
  )
}

const fieldId = (setId: string, key: 'weight' | 'reps' | 'duration') => `set-${setId}-${key}`

const SET_LABEL: Record<SetType, string> = { warmup: 'W', normal: '', drop: 'D', failure: 'F' }

// A routine can use any 15 s step, so make sure its value is always selectable.
const REST_PRESETS = [0, 30, 60, 90, 120, 150, 180, 240, 300]
const restOptions = (current: number) =>
  [...new Set([...REST_PRESETS, current])].sort((a, b) => a - b)

function ExerciseCard({
  ex,
  handle,
  previous,
  onToggleDone,
  open,
  onOpenChange,
  missingSetId,
  onEdited,
}: {
  missingSetId: string | null
  onEdited: (setId: string) => void
  ex: DraftExercise
  handle: HandleProps
  previous: PreviousSet[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleDone: (
    ex: DraftExercise,
    set: DraftSet,
    prev: PreviousSet | undefined,
    origin: { x: number; y: number },
  ) => void
}) {
  let normalCount = 0
  const timed = ex.kind === 'duration'
  const doneCount = ex.sets.filter((s) => s.completed).length
  const required = requiredField(ex.kind)
  const missingIndex = ex.sets.findIndex((s) => s.id === missingSetId)
  const errorId = `missing-${ex.id}`
  const allDone = ex.sets.length > 0 && doneCount === ex.sets.length

  return (
    <section className="card exercise-card" aria-label={ex.name}>
      <Disclosure
        className="exercise-disclosure"
        open={open}
        onOpenChange={onOpenChange}
        // The handle stays usable while folded: that is the point of folding.
        leading={<DragHandle handle={handle} label={`Reorder ${ex.name}`} />}
        summary={
          <span className="exercise-summary">
            <ExerciseThumb imagePath={ex.imagePath} name={ex.name} size={44} decorative />
            <span className="exercise-title">{ex.name}</span>
            <small className={allDone ? 'set-count done' : 'set-count'}>
              {doneCount}/{ex.sets.length} sets
            </small>
          </span>
        }
        actions={
          <>
            {/* Mid-set "how was this done again?": the most useful place for it. */}
            {!ex.custom && (
              <HowToButton
                exercise={{ id: ex.exerciseId, name: ex.name, imagePath: ex.imagePath }}
              />
            )}
            <button
              className="icon-btn danger"
              aria-label={`Remove ${ex.name}`}
              onClick={() =>
                confirm(`Remove ${ex.name} from this workout?`) &&
                setDraft((d) => removeExercise(d, ex.id))
              }
            >
              ✕
            </button>
          </>
        }
      >
        <div className="exercise-body">
          <input
            className="note-input"
            placeholder="Notes"
            aria-label={`Notes for ${ex.name}`}
            value={ex.notes}
            onChange={(e) => setDraft((d) => updateExercise(d, ex.id, { notes: e.target.value }))}
          />

          <table className="sets">
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">Previous</th>
                <th scope="col">{ex.kind === 'bodyweight_reps' ? '+kg' : 'kg'}</th>
                <th scope="col">{timed ? 'sec' : 'Reps'}</th>
                <th scope="col">
                  <span className="sr-only">Done</span>
                </th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((s, i) => {
                if (s.setType === 'normal') normalCount++
                const label = SET_LABEL[s.setType] || String(normalCount)
                const prev = previous[i]
                const field = (
                  key: 'weight' | 'reps' | 'duration',
                  placeholder: string,
                  decimal: boolean,
                ) => {
                  const invalid = s.id === missingSetId && key === required
                  return (
                    <td>
                      <input
                        id={fieldId(s.id, key)}
                        className={invalid ? 'num-input invalid' : 'num-input'}
                        inputMode={decimal ? 'decimal' : 'numeric'}
                        aria-label={`Set ${i + 1} ${key}`}
                        aria-invalid={invalid || undefined}
                        aria-describedby={invalid ? errorId : undefined}
                        placeholder={placeholder}
                        value={s[key]}
                        onChange={(e) => {
                          setDraft((d) => updateSet(d, ex.id, s.id, { [key]: e.target.value }))
                          onEdited(s.id)
                        }}
                      />
                    </td>
                  )
                }
                return (
                  <tr key={s.id} className={s.completed ? 'done' : undefined}>
                    <td>
                      <button
                        className={`set-type ${s.setType}`}
                        aria-label={`Set ${i + 1} type: ${s.setType}. Tap to change`}
                        onClick={() =>
                          setDraft((d) =>
                            updateSet(d, ex.id, s.id, { setType: nextSetType(s.setType) }),
                          )
                        }
                      >
                        {label}
                      </button>
                    </td>
                    <td className="prev">{prev ? formatSetValues(ex.kind, prev) : '—'}</td>
                    {field(
                      'weight',
                      prev?.weight_kg
                        ? String(prev.weight_kg)
                        : ex.kind === 'weight_reps'
                          ? ''
                          : 'BW',
                      true,
                    )}
                    {timed
                      ? field('duration', prev?.duration_s?.toString() ?? '', false)
                      : field('reps', prev?.reps?.toString() ?? '', false)}
                    <td>
                      <button
                        className={s.completed ? 'check on' : 'check'}
                        aria-pressed={s.completed}
                        aria-label={`Set ${i + 1} done`}
                        onClick={(e) => {
                          // The burst starts from the ✓ that was tapped.
                          const r = e.currentTarget.getBoundingClientRect()
                          onToggleDone(ex, s, prev, {
                            x: r.left + r.width / 2,
                            y: r.top + r.height / 2,
                          })
                        }}
                      >
                        ✓
                      </button>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={`Remove set ${i + 1}`}
                        onClick={() => setDraft((d) => removeSet(d, ex.id, s.id))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {missingIndex >= 0 && (
            <p id={errorId} role="alert" className="error small-text">
              Enter {required === 'duration' ? 'the time' : 'reps'} for set {missingIndex + 1}, then
              tick it.
            </p>
          )}

          <div className="row between">
            <button className="btn small" onClick={() => setDraft((d) => addSet(d, ex.id))}>
              + Add set
            </button>
            <label className="row muted small-text">
              Rest
              <select
                aria-label={`Rest time for ${ex.name}`}
                value={ex.restSeconds}
                onChange={(e) =>
                  setDraft((d) => updateExercise(d, ex.id, { restSeconds: Number(e.target.value) }))
                }
              >
                {restOptions(ex.restSeconds).map((sec) => (
                  <option key={sec} value={sec}>
                    {sec === 0 ? 'Off' : formatDuration(sec)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </Disclosure>
    </section>
  )
}
