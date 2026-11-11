import { useEffect, useId, useState, type FormEvent } from 'react'
import { exerciseImageUrl } from '../../shared/ui/exerciseImage'
import {
  EQUIPMENT,
  MUSCLE_GROUPS,
  MUSCLE_SUBGROUPS,
  muscleLabel,
  muscleParent,
  type Exercise,
  type ExerciseKind,
} from '../../types/db'
import { useIsAdmin } from '../auth/AuthProvider'
import { useSaveBuiltInExercise, useSaveCustomExercise, type PhotoChanges } from './api'
import { toSquareJpeg } from './resizeImage'

/** Muscles that can be a secondary target: the specific ones, no plain group, no cardio. */
const SECONDARY_CHOICES = MUSCLE_GROUPS.flatMap((g) =>
  g === 'cardio' ? [] : (MUSCLE_SUBGROUPS[g] ?? [g]),
)

interface Props {
  /** The exercise to edit: the member's own custom one, or a built-in (admins). Missing = new. */
  exercise?: Exercise
  /** Its current steps, when editing. */
  initialSteps?: string[]
  /** Every visible exercise, to catch a built-in name that is already taken. */
  library: Exercise[]
  onDone: () => void
}

/**
 * Custom exercise for everyone (new, or editing their own; no photo); admins
 * can also make it a built-in (with photos and steps, shown to every user) or
 * edit an existing built-in.
 */
export function ExerciseForm({ exercise, initialSteps = [], library, onDone }: Props) {
  const isAdmin = useIsAdmin()
  const saveCustom = useSaveCustomExercise()
  const saveBuiltIn = useSaveBuiltInExercise()
  const editing = !!exercise

  const [name, setName] = useState(exercise?.name ?? '')
  const [muscle, setMuscle] = useState<string>(exercise?.muscle_group ?? MUSCLE_GROUPS[0])
  const [equipment, setEquipment] = useState<string>(exercise?.equipment ?? EQUIPMENT[0])
  const [kind, setKind] = useState<ExerciseKind>(exercise?.kind ?? 'weight_reps')
  const [builtIn, setBuiltIn] = useState(!!exercise && !exercise.user_id)
  // Past sets of a custom exercise were logged for its kind; changing it would
  // show them wrong (kg × reps read as a duration). A new exercise instead.
  const kindLocked = editing && !builtIn
  const [steps, setSteps] = useState(initialSteps.join('\n'))
  const [secondary, setSecondary] = useState<string[]>(exercise?.secondary_muscles ?? [])
  // From the exercise, not false: saving a hidden built-in must not unhide it.
  const [hidden, setHidden] = useState(exercise?.hidden ?? false)
  const [photos, setPhotos] = useState<PhotoChanges>({})
  const [formError, setFormError] = useState<string | null>(null)
  const kindHintId = useId()

  const pending = saveCustom.isPending || saveBuiltIn.isPending
  const error = formError ?? saveCustom.error?.message ?? saveBuiltIn.error?.message

  function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const fields = { name: name.trim(), muscle_group: muscle, equipment, kind }
    if (!builtIn) {
      saveCustom.mutate({ id: exercise?.id, fields }, { onSuccess: onDone })
      return
    }

    const stepList = steps
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
    const taken = library.some(
      (other) =>
        !other.user_id &&
        other.id !== exercise?.id &&
        other.name.toLowerCase() === fields.name.toLowerCase(),
    )
    if (taken) return setFormError(`A built-in called "${fields.name}" already exists.`)
    if (!photos.start && !exercise?.image_path) return setFormError('Add a start photo.')
    if (stepList.length === 0) return setFormError('Add at least one step.')

    saveBuiltIn.mutate(
      {
        id: exercise?.id,
        fields: {
          ...fields,
          instructions: stepList,
          hidden,
          // A muscle in the primary's group would be counted twice: drop it.
          secondary_muscles: secondary.filter((m) => muscleParent(m) !== muscleParent(muscle)),
        },
        photos,
        current: exercise && {
          image_path: exercise.image_path,
          image_path_end: exercise.image_path_end ?? null,
        },
      },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <label className="field">
        <span>Name</span>
        <input required value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Muscle group</span>
        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          {MUSCLE_GROUPS.map((m) => {
            const subs = MUSCLE_SUBGROUPS[m]
            if (!subs) return <option key={m}>{m}</option>
            return (
              <optgroup key={m} label={m}>
                <option value={m}>{m} (general)</option>
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {muscleLabel(s)}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </label>
      <label className="field">
        <span>Equipment</span>
        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          {EQUIPMENT.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Tracked as</span>
        <select
          value={kind}
          disabled={kindLocked}
          aria-describedby={kindLocked ? kindHintId : undefined}
          onChange={(e) => setKind(e.target.value as ExerciseKind)}
        >
          <option value="weight_reps">Weight × reps</option>
          <option value="bodyweight_reps">Reps only</option>
          <option value="duration">Duration</option>
        </select>
        {kindLocked && (
          <small id={kindHintId} className="muted">
            Fixed once created, so past sets still read right. Need another kind? Make a new
            exercise.
          </small>
        )}
      </label>

      {isAdmin && !editing && (
        <label className="check-field">
          <input type="checkbox" checked={builtIn} onChange={(e) => setBuiltIn(e.target.checked)} />
          <span>Built-in (shown to everyone)</span>
        </label>
      )}

      {builtIn && (
        <>
          <div className="photo-fields">
            <PhotoField
              label="Start photo"
              current={exercise?.image_path ?? null}
              value={photos.start}
              onChange={(blob) => setPhotos((p) => ({ ...p, start: blob ?? undefined }))}
              onError={setFormError}
            />
            <PhotoField
              label="End photo (optional)"
              current={photos.end === null ? null : (exercise?.image_path_end ?? null)}
              value={photos.end ?? undefined}
              onChange={(blob) => setPhotos((p) => ({ ...p, end: blob }))}
              onError={setFormError}
              removable
            />
          </div>
          <fieldset className="field secondary-muscles">
            <legend>Also works (counted in weekly stats)</legend>
            <div className="chip-wrap">
              {SECONDARY_CHOICES.filter((m) => muscleParent(m) !== muscleParent(muscle)).map(
                (m) => {
                  const on = secondary.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      className={on ? 'chip small on' : 'chip small'}
                      aria-pressed={on}
                      onClick={() =>
                        setSecondary((list) => (on ? list.filter((x) => x !== m) : [...list, m]))
                      }
                    >
                      {muscleLabel(m)}
                    </button>
                  )
                },
              )}
            </div>
          </fieldset>
          <label className="field">
            <span>Steps (one per line)</span>
            <textarea rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} />
          </label>
          {editing && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={hidden}
                onChange={(e) => setHidden(e.target.checked)}
              />
              <span>Hidden (no longer offered; history keeps it)</span>
            </label>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button className="btn primary" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  )
}

/** One photo: preview (new pick, else the current file) and a picker. */
function PhotoField({
  label,
  current,
  value,
  onChange,
  onError,
  removable = false,
}: {
  label: string
  current: string | null
  value: Blob | undefined
  /** The resized photo; null = remove the current one. */
  onChange: (blob: Blob | null) => void
  onError: (message: string | null) => void
  removable?: boolean
}) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  // Object URLs hold the blob in memory until revoked.
  useEffect(() => {
    if (!value) return setPreview(null)
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const src = preview ?? (current ? exerciseImageUrl(current) : null)

  return (
    <div className="photo-field">
      <span className="small-text">{label}</span>
      {src ? (
        <img src={src} alt={`${label} preview`} width={96} height={96} className="thumb" />
      ) : (
        <span className="thumb placeholder photo-empty" aria-hidden="true" />
      )}
      {/* accept="image/*" lets iOS offer the camera as well as the library.
          The input is visually hidden; the label after it is the button
          (and shows the input's keyboard focus, see .photo-field CSS). */}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        aria-label={label}
        className="sr-only"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // picking the same file again still fires change
          if (!file) return
          setBusy(true)
          onError(null)
          try {
            onChange(await toSquareJpeg(file))
          } catch (err) {
            onError(err instanceof Error ? err.message : 'This image could not be used.')
          } finally {
            setBusy(false)
          }
        }}
      />
      <label htmlFor={inputId} className="btn small" aria-hidden="true">
        {busy ? 'Resizing…' : src ? 'Change' : 'Choose'}
      </label>
      {removable && src && (
        <button type="button" className="btn small" onClick={() => onChange(null)}>
          Remove
        </button>
      )}
    </div>
  )
}
