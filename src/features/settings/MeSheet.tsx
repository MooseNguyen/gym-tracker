import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Unit } from '../../shared/units'
import { useAuth } from '../auth/AuthProvider'
import { fetchAllWorkouts } from '../history/api'
import { useDraft } from '../workout/draftStore'
import { useProfile, useSetUnit } from './api'
import { saveFile, workoutsToCsv } from './csv'

const UNITS: Unit[] = ['kg', 'lb']

/** The account sheet behind the "Me" tab: settings, export, log out. */
export function MeSheetBody({ onLogOut }: { onLogOut: () => void }) {
  const email = useAuth().session?.user.email
  return (
    <div className="stack me-sheet">
      {email && <p className="muted">{email}</p>}
      <UnitSetting />
      <ExportCsv />
      <button type="button" className="btn block danger" onClick={onLogOut}>
        Log out
      </button>
    </div>
  )
}

function UnitSetting() {
  const profile = useProfile()
  const setUnit = useSetUnit()
  const draft = useDraft()
  const unit = profile.data?.unit ?? 'kg'
  // The draft keeps the unit it started with; say so instead of converting
  // numbers under the lifter's thumb.
  const draftDiffers = !!draft && (draft.unit ?? 'kg') !== unit

  return (
    <section className="stack me-section" aria-labelledby="unit-heading">
      <h3 id="unit-heading">Weight unit</h3>
      <div className="segmented" role="group" aria-labelledby="unit-heading">
        {UNITS.map((u) => (
          <button
            key={u}
            type="button"
            className={u === unit ? 'on' : ''}
            aria-pressed={u === unit}
            disabled={profile.isPending}
            onClick={() => u !== unit && setUnit.mutate(u)}
          >
            {u}
          </button>
        ))}
      </div>
      <p className="muted small-text">
        History and stats switch at once; nothing you logged changes.
      </p>
      {draftDiffers && (
        <p className="muted small-text">
          The workout in progress stays in {draft.unit ?? 'kg'} until you finish it.
        </p>
      )}
      {setUnit.error && (
        <p role="alert" className="error small-text">
          Could not save the unit: {setUnit.error.message}
        </p>
      )}
    </section>
  )
}

type ExportState =
  | { step: 'idle' }
  | { step: 'loading' }
  | { step: 'ready'; file: File; sets: number; unit: Unit }
  | { step: 'done' }
  | { step: 'error'; message: string }

/**
 * Two taps on purpose: the first loads every workout, the second hands the
 * file over. iOS only opens the share sheet straight from a tap, and loading
 * a long history can take longer than Safari keeps that tap "fresh".
 */
function ExportCsv() {
  const unit = useProfile().data?.unit ?? 'kg'
  const [state, setState] = useState<ExportState>({ step: 'idle' })

  async function prepare() {
    setState({ step: 'loading' })
    try {
      const workouts = await fetchAllWorkouts()
      const csv = workoutsToCsv(workouts, unit)
      const sets = workouts.reduce(
        (n, w) => n + w.workout_exercises.reduce((m, we) => m + we.sets.length, 0),
        0,
      )
      const name = `gym-tracker-${new Date().toISOString().slice(0, 10)}.csv`
      setState({ step: 'ready', file: new File([csv], name, { type: 'text/csv' }), sets, unit })
    } catch (e) {
      setState({ step: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  // Cancelling the share sheet keeps the file ready for another try.
  async function save(file: File) {
    if ((await saveFile(file)) === 'saved') setState({ step: 'done' })
  }

  return (
    <section className="stack me-section" aria-labelledby="export-heading">
      <h3 id="export-heading">Your data</h3>
      {state.step === 'ready' ? (
        <>
          <button type="button" className="btn block primary" onClick={() => save(state.file)}>
            Save {state.file.name}
          </button>
          <p className="muted small-text">
            {state.sets} set{state.sets === 1 ? '' : 's'}, weights in {state.unit}.
          </p>
        </>
      ) : (
        <button
          type="button"
          className="btn block"
          onClick={prepare}
          disabled={state.step === 'loading'}
        >
          {state.step === 'loading' ? 'Preparing…' : 'Export workouts (CSV)'}
        </button>
      )}
      {state.step === 'done' && <p className="muted small-text">Exported.</p>}
      {state.step === 'error' && (
        <p role="alert" className="error small-text">
          Export failed: {state.message}
        </p>
      )}
    </section>
  )
}

/** Body of the log-out dialog. A failed sign-out keeps the dialog open with the reason. */
export function LogoutConfirm({ onCancel }: { onCancel: () => void }) {
  const hasDraft = !!useDraft()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function logOut() {
    setPending(true)
    setError(null)
    // On success onAuthStateChange clears the session and RequireAuth sends
    // the user to /login, which unmounts this dialog.
    const { error } = await supabase.auth.signOut()
    if (error) {
      setError(error.message)
      setPending(false)
    }
  }

  return (
    <div className="stack">
      <p>You will need your email and password to sign in again.</p>
      {hasDraft && (
        <p className="muted">
          Your unfinished workout stays saved on this phone and will be here when you sign back in.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="row">
        <button type="button" className="btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
        <button type="button" className="btn danger grow" onClick={logOut} disabled={pending}>
          {pending ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </div>
  )
}
