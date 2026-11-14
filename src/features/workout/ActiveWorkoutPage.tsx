import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { HowToSheet } from '../exercises/HowTo'
import { formatSetIn, formatSetValues } from '../history/format'
import { formatAmount, fromKg, MAX_WEIGHT, type Unit } from '../../shared/units'
import { useConfirm } from '../../shared/ui/confirmContext'
import { Dialog } from '../../shared/ui/Dialog'
import { Disclosure } from '../../shared/ui/Disclosure'
import { ExerciseThumb } from '../../shared/ui/ExerciseThumb'
import { MoveButtons, SortableList, type ItemControls } from '../../shared/ui/SortableList'
import type { Exercise, PreviousSet, SetType } from '../../types/db'
import {
  addExercises,
  addSet,
  applySuggestions,
  completedSetCount,
  completedVolume,
  describeImprovement,
  improvementOver,
  draftUnit,
  MAX_REPS,
  parseNumber,
  removeExercise,
  removeSet,
  reorderExercises,
  replaceExercise,
  requiredField,
  toSavePayload,
  toggleSetComplete,
  tooLargeCompletedSets,
  tooLargeField,
  updateExercise,
  updateSet,
  type DraftExercise,
  type DraftSet,
  type WorkoutDraft,
} from './draft'
import { getDraft, setDraft, useDraft } from './draftStore'
import { NetworkError } from '../../lib/supabase'
import { usePreviousSets, useSaveWorkout } from './api'
import { PrBanner, type Celebration } from './PrBanner'
import { describeReason, headlineSuggestion, suggestSets } from './progression'
import { playCelebration } from './celebrate'
import { PlateSheet } from './PlateSheet'
import { ReorderSheet } from './ReorderSheet'
import { RestTimer } from './RestTimer'
import { RestPickerSheet, TimerSheet } from './TimerSheets'
import { spokenSeconds, STOPPED, stopwatchElapsed } from './timers'
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
  const confirm = useConfirm()
  // Finish was pressed with nothing ticked: explain next to the button.
  const [finishHint, setFinishHint] = useState(false)
  // Sheets opened from an exercise's ⋯ menu.
  const [howTo, setHowTo] = useState<DraftExercise | null>(null)
  const [replacing, setReplacing] = useState<DraftExercise | null>(null)
  const [reordering, setReordering] = useState(false)
  const [timerOpen, setTimerOpen] = useState(false)
  const isNew = draft?.mode === 'new'
  const now = useNow(1000, isNew)
  const stopwatch = draft?.stopwatch ?? STOPPED
  const stopwatchRunning = stopwatch.startedAt != null
  // Floor, like any stopwatch: 3.6 s is still "0:03" (formatDuration rounds).
  const stopwatchText = formatDuration(Math.floor(stopwatchElapsed(stopwatch, now) / 1000))
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
  // Offline (paused by TanStack) or between retries after a network failure.
  const waitingForSignal =
    save.isPaused || (save.isPending && save.failureReason instanceof NetworkError)
  const unit = draftUnit(draft)
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
      const field = tooLargeField(set, unit) ?? requiredField(ex.kind)
      document.getElementById(fieldId(set.id, field))?.focus()
      return
    }
    setMissing(null)
    // Only when ticking on (not off), and not while editing an old workout.
    if (!isNew || set.completed || !completedSet?.completed) return
    const gain = improvementOver(completedSet, prev, unit)
    if (!gain) return
    setCelebration({ id: Date.now(), exercise: ex.name, text: describeImprovement(gain, unit) })
    playCelebration(origin)
  }

  async function finish() {
    if (!draft) return
    if (completed === 0) {
      setFinishHint(true)
      return
    }
    setFinishHint(false)
    if (tooLargeCompletedSets(draft) > 0) return // the card shows which set and why
    const unfinished = draft.exercises.reduce(
      (n, e) => n + e.sets.filter((s) => !s.completed).length,
      0,
    )
    if (
      unfinished > 0 &&
      !(await confirm({
        title: 'Finish workout?',
        message: `${unfinished} unticked ${unfinished === 1 ? 'set' : 'sets'} will not be saved.`,
        confirmLabel: 'Finish',
      }))
    )
      return

    send(draft)
  }

  function send(sent: WorkoutDraft) {
    save.mutate(toSavePayload(sent), {
      onSuccess: (id) => {
        // Edited while the save waited for signal: those edits must not be
        // dropped. Same id, so this replaces what was just saved.
        const latest = getDraft()
        if (latest && latest !== sent) {
          // Not sendable as it is now: keep it here; the cards say why.
          if (completedSetCount(latest) === 0 || tooLargeCompletedSets(latest) > 0) return
          send(latest)
          return
        }
        setDraft(null)
        navigate(`/history/${id}`, { replace: true })
      },
    })
  }

  async function removeWithConfirm(ex: DraftExercise) {
    const ok = await confirm({
      title: `Remove ${ex.name}?`,
      message: 'Its sets in this workout are removed too.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (ok) setDraft((d) => removeExercise(d, ex.id))
  }

  /** In the reorder list: instant for an untouched exercise, asks when sets are logged. */
  async function removeFromList(ex: DraftExercise) {
    if (ex.sets.some((s) => s.completed)) return removeWithConfirm(ex)
    setDraft((d) => removeExercise(d, ex.id))
  }

  async function replaceWith(target: DraftExercise, picked: Exercise) {
    const logged = target.sets.filter((s) => s.completed).length
    if (logged > 0) {
      const ok = await confirm({
        title: `Replace ${target.name}?`,
        message: `${logged} logged ${logged === 1 ? 'set is' : 'sets are'} cleared: the numbers belong to ${target.name}.`,
        confirmLabel: 'Replace',
        danger: true,
      })
      if (!ok) return
    }
    setDraft((d) => replaceExercise(d, target.id, picked))
  }

  async function discard() {
    const editing = draft?.mode === 'edit'
    const ok = await confirm({
      title: editing ? 'Discard your changes?' : 'Discard this workout?',
      message: editing ? 'The saved workout stays as it was.' : 'Nothing will be saved.',
      confirmLabel: 'Discard',
      danger: true,
    })
    if (!ok) return
    setDraft(null)
    navigate(draft?.mode === 'edit' ? `/history/${draft.id}` : '/', { replace: true })
  }

  return (
    <main className="page workout">
      {/* Sticky: the clock, the totals and Finish stay in reach while scrolling. */}
      <header className="workout-bar">
        <div className="workout-bar-top">
          <input
            className="title-input"
            aria-label="Workout name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {isNew && (
            <button
              type="button"
              className={stopwatchRunning ? 'timer-btn running' : 'timer-btn'}
              aria-label={stopwatchRunning ? `Timer (stopwatch at ${stopwatchText})` : 'Timer'}
              aria-haspopup="dialog"
              onClick={() => setTimerOpen(true)}
            >
              <ClockIcon />
              {stopwatchRunning && <span>{stopwatchText}</span>}
            </button>
          )}
          <button
            type="button"
            className="btn primary finish-btn"
            aria-label={isNew ? 'Finish workout' : 'Save changes'}
            onClick={finish}
            disabled={save.isPending}
          >
            {waitingForSignal
              ? 'Waiting for signal…'
              : save.isPending
                ? 'Saving…'
                : isNew
                  ? 'Finish'
                  : 'Save'}
          </button>
        </div>
        <dl className="workout-stats">
          <div>
            <dt className="stat-label">Duration</dt>
            <dd className="stat-value">
              {isNew ? formatDuration((now - Date.parse(draft.startedAt)) / 1000) : 'Editing'}
            </dd>
          </div>
          <div>
            <dt className="stat-label">Volume</dt>
            <dd className="stat-value">{formatAmount(completedVolume(draft), unit)}</dd>
          </div>
          <div>
            <dt className="stat-label">Sets</dt>
            <dd className="stat-value">{completed}</dd>
          </div>
        </dl>
      </header>

      {/* Next to Finish's new place, at the top. */}
      {waitingForSignal && (
        <p role="status" className="muted">
          No signal. Your workout is safe on this phone and will be saved when you're back online.
        </p>
      )}
      {save.error && (
        <p role="alert" className="error">
          Saving failed: {save.error.message}. Your workout is still on this phone. Try again.
        </p>
      )}
      {finishHint && completed === 0 && (
        <p role="alert" className="error">
          Tick at least one set before finishing, or discard the workout.
        </p>
      )}

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
          renderItem={(ex, controls) => (
            <ExerciseCard
              ex={ex}
              controls={controls}
              previous={previous.data?.get(ex.exerciseId) ?? []}
              unit={unit}
              suggest={isNew}
              onToggleDone={toggleDone}
              missingSetId={missing}
              onEdited={(setId) => setMissing((m) => (m === setId ? null : m))}
              actions={{
                onHowTo: () => setHowTo(ex),
                onReplace: () => setReplacing(ex),
                onReorder: () => setReordering(true),
                onRemove: () => removeWithConfirm(ex),
              }}
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

      <button className="btn primary block" onClick={() => setPicking(true)}>
        + Add exercises
      </button>

      {/* Workout notes are no longer edited here; existing ones are kept on save. */}
      <button className="btn danger block" onClick={discard} disabled={save.isPending}>
        {isNew ? 'Discard workout' : 'Discard changes'}
      </button>

      {isNew && draft.restEndsAt && (
        <RestTimer endsAt={draft.restEndsAt} totalMs={draft.restTotalMs} />
      )}
      <TimerSheet open={timerOpen} onClose={() => setTimerOpen(false)} />
      <PrBanner celebration={celebration} onDone={clearCelebration} />

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ex) => setDraft((d) => addExercises(d, ex))}
      />
      <ExercisePicker
        open={replacing != null}
        single
        title={replacing ? `Replace ${replacing.name}` : undefined}
        onClose={() => setReplacing(null)}
        onPick={([picked]) => {
          const target = replacing
          if (target && picked) replaceWith(target, picked)
        }}
      />
      <ReorderSheet
        open={reordering}
        exercises={draft.exercises}
        onReorder={(from, to) => setDraft((d) => reorderExercises(d, from, to))}
        onRemove={removeFromList}
        onClose={() => setReordering(false)}
      />
      <HowToSheet
        exercise={
          howTo && {
            id: howTo.exerciseId,
            name: howTo.name,
            imagePath: howTo.imagePath,
            imagePathEnd: howTo.imagePathEnd,
          }
        }
        onClose={() => setHowTo(null)}
      />
    </main>
  )
}

const fieldId = (setId: string, key: 'weight' | 'reps' | 'duration') => `set-${setId}-${key}`

const SET_LABEL: Record<SetType, string> = { warmup: 'W', normal: '', drop: 'D', failure: 'F' }

const SET_TYPES: { value: SetType; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'warmup', label: 'Warm-up' },
  { value: 'drop', label: 'Drop set' },
  { value: 'failure', label: 'Failure' },
]

export interface CardActions {
  onHowTo: () => void
  onReplace: () => void
  onReorder: () => void
  onRemove: () => void
}

function ExerciseCard({
  ex,
  controls,
  previous,
  unit,
  suggest,
  onToggleDone,
  open,
  onOpenChange,
  missingSetId,
  onEdited,
  actions,
}: {
  missingSetId: string | null
  onEdited: (setId: string) => void
  ex: DraftExercise
  controls: ItemControls
  /** Last time's sets, weights in kg as stored. */
  previous: PreviousSet[]
  /** The draft's unit: what the weight inputs are typed in. */
  unit: Unit
  /** Show next-target suggestions: new workouts only, not when editing an old one. */
  suggest: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggleDone: (
    ex: DraftExercise,
    set: DraftSet,
    prev: PreviousSet | undefined,
    origin: { x: number; y: number },
  ) => void
  actions: CardActions
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [platesOpen, setPlatesOpen] = useState(false)
  const barbell = ex.equipment === 'barbell' && ex.kind === 'weight_reps'
  // Notes stay out of the way until asked for (or already written).
  const [notesOpen, setNotesOpen] = useState(() => ex.notes !== '')
  const [restOpen, setRestOpen] = useState(false)
  let normalCount = 0
  const timed = ex.kind === 'duration'
  const required = requiredField(ex.kind)
  const missingIndex = ex.sets.findIndex((s) => s.id === missingSetId)
  const tooLargeIndex = ex.sets.findIndex((s) => tooLargeField(s, unit))
  const errorId = `missing-${ex.id}`
  const notesId = `notes-${ex.id}`

  // Menu items close the menu first: one sheet at a time.
  const run = (action: () => void) => () => {
    setMenuOpen(false)
    action()
  }

  return (
    // The whole card is the drag activator (press and hold on touch);
    // SortableList ignores presses that start on inputs and buttons.
    <section
      ref={controls.dragRef}
      {...controls.dragListeners}
      className={controls.isDragging ? 'card exercise-card dragging' : 'card exercise-card'}
      aria-label={ex.name}
    >
      <MoveButtons controls={controls} label={ex.name} />
      <Disclosure
        className="exercise-disclosure"
        open={open}
        onOpenChange={onOpenChange}
        summary={
          <span className="exercise-summary">
            <ExerciseThumb imagePath={ex.imagePath} name={ex.name} size={36} decorative />
            <span className="exercise-title">{ex.name}</span>
          </span>
        }
        actions={
          <button
            type="button"
            className="icon-btn"
            aria-label={`More actions for ${ex.name}`}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen(true)}
          >
            <MoreIcon />
          </button>
        }
      >
        <div className="exercise-body">
          {suggest && <SuggestionLine ex={ex} previous={previous} unit={unit} />}

          <div className="exercise-tools">
            <button
              type="button"
              className="tool-chip"
              aria-label={`Rest time for ${ex.name}: ${spokenSeconds(ex.restSeconds)}`}
              aria-haspopup="dialog"
              onClick={() => setRestOpen(true)}
            >
              <span aria-hidden="true">⏱</span>
              {ex.restSeconds === 0 ? 'Rest off' : `Rest ${formatDuration(ex.restSeconds)}`}
            </button>
            <button
              type="button"
              className={notesOpen ? 'tool-chip on' : 'tool-chip'}
              aria-expanded={notesOpen}
              aria-controls={notesId}
              onClick={() => setNotesOpen((o) => !o)}
            >
              <span aria-hidden="true">✎</span> Notes
              {ex.notes && !notesOpen && <span className="tool-dot" aria-label="(has notes)" />}
            </button>
          </div>
          {notesOpen && (
            <input
              id={notesId}
              className="note-input"
              placeholder="Notes for this exercise"
              aria-label={`Notes for ${ex.name}`}
              // Opened on purpose: ready to type. Not when it opens itself for existing notes.
              autoFocus={ex.notes === ''}
              value={ex.notes}
              onChange={(e) => setDraft((d) => updateExercise(d, ex.id, { notes: e.target.value }))}
            />
          )}

          <table className="sets">
            <thead>
              <tr>
                <th scope="col">Set</th>
                <th scope="col">Previous</th>
                <th scope="col">{ex.kind === 'bodyweight_reps' ? `+${unit}` : unit}</th>
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
                const tooLarge = tooLargeField(s, unit)
                const field = (
                  key: 'weight' | 'reps' | 'duration',
                  placeholder: string,
                  decimal: boolean,
                ) => {
                  const invalid =
                    tooLarge === key || (!tooLarge && s.id === missingSetId && key === required)
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
                      {/* A real <select> laid transparently over the badge: tapping it
                          opens the native iOS picker, and it is accessible as is. */}
                      <span className={`set-type ${s.setType}`}>
                        <span aria-hidden="true">{label}</span>
                        <select
                          aria-label={`Set ${i + 1} type`}
                          value={s.setType}
                          onChange={(e) =>
                            setDraft((d) =>
                              updateSet(d, ex.id, s.id, { setType: e.target.value as SetType }),
                            )
                          }
                        >
                          {SET_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                      </span>
                    </td>
                    <td className="prev">{prev ? formatSetValues(ex.kind, prev, unit) : '—'}</td>
                    {field(
                      'weight',
                      prev?.weight_kg
                        ? String(fromKg(prev.weight_kg, unit))
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

          {tooLargeIndex >= 0 ? (
            <p id={errorId} role="alert" className="error small-text">
              Set {tooLargeIndex + 1}: weight can be at most {MAX_WEIGHT[unit]} {unit}, reps{' '}
              {MAX_REPS}.
            </p>
          ) : (
            missingIndex >= 0 && (
              <p id={errorId} role="alert" className="error small-text">
                Enter {required === 'duration' ? 'the time' : 'reps'} for set {missingIndex + 1},
                then tick it.
              </p>
            )
          )}

          <button className="btn block" onClick={() => setDraft((d) => addSet(d, ex.id))}>
            + Add set
          </button>
        </div>
      </Disclosure>

      <RestPickerSheet
        open={restOpen}
        exerciseName={ex.name}
        value={ex.restSeconds}
        onClose={() => setRestOpen(false)}
        onDone={(sec) => {
          setDraft((d) => updateExercise(d, ex.id, { restSeconds: sec }))
          setRestOpen(false)
        }}
      />
      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={ex.name}>
        <div className="stack action-sheet">
          {!ex.custom && (
            <button type="button" className="btn block" onClick={run(actions.onHowTo)}>
              How to do it
            </button>
          )}
          {barbell && (
            <button type="button" className="btn block" onClick={run(() => setPlatesOpen(true))}>
              Plate calculator
            </button>
          )}
          <button type="button" className="btn block" onClick={run(actions.onReplace)}>
            Replace exercise
          </button>
          <button type="button" className="btn block" onClick={run(actions.onReorder)}>
            Reorder exercises
          </button>
          <button type="button" className="btn block danger" onClick={run(actions.onRemove)}>
            Remove exercise
          </button>
        </div>
      </Dialog>
      {barbell && (
        <PlateSheet
          open={platesOpen}
          initialWeight={nextSetWeight(ex)}
          unit={unit}
          onClose={() => setPlatesOpen(false)}
        />
      )}
    </section>
  )
}

/** The weight to load next: the first set not done yet, else the last one entered. */
function nextSetWeight(ex: DraftExercise): number | null {
  const pending = ex.sets.find((s) => !s.completed && parseNumber(s.weight) != null)
  if (pending) return parseNumber(pending.weight)
  const entered = ex.sets.filter((s) => parseNumber(s.weight) != null)
  return entered.length ? parseNumber(entered[entered.length - 1].weight) : null
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M10 2h4" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="12" r="2" fill="currentColor" />
    </svg>
  )
}

/**
 * Next target from last time's sets (RPE first, else double progression).
 * Apply fills only empty fields of unticked sets; ticking without applying
 * still logs last time's numbers, as before.
 */
function SuggestionLine({
  ex,
  previous,
  unit,
}: {
  ex: DraftExercise
  previous: PreviousSet[]
  unit: Unit
}) {
  const suggestions = suggestSets(ex.kind, ex.equipment, previous, unit)
  const head = headlineSuggestion(previous, suggestions)
  if (!head) return null

  const field = requiredField(ex.kind)
  const canFill = ex.sets.some((s, i) => suggestions[i] && !s.completed && !s[field])
  const target = formatSetIn(
    ex.kind,
    { weight: head.weight, reps: head.reps, duration_s: head.duration },
    unit,
  )

  return (
    <div className="suggestion">
      <span className="grow">
        Try <strong>{target}</strong> <small className="muted">· {describeReason(head)}</small>
      </span>
      <button
        type="button"
        className="btn small"
        aria-label={`Apply suggestion for ${ex.name}`}
        disabled={!canFill}
        onClick={() => setDraft((d) => applySuggestions(d, ex.id, suggestions))}
      >
        Apply
      </button>
    </div>
  )
}
