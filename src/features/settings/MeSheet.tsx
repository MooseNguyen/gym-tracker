import { useState } from 'react'
import { Link } from 'react-router'
import { reportError } from '../../lib/monitoring'
import { supabase } from '../../lib/supabase'
import type { Unit } from '../../shared/units'
import { useAuth } from '../auth/AuthProvider'
import { fetchBodyWeights } from '../body/api'
import { bodyWeightsToCsv } from '../body/bodyWeight'
import { fetchAllWorkouts } from '../history/api'
import { turnOffRestPush } from '../notifications/restPush'
import { RestPushSetting } from '../notifications/RestPushSetting'
import { dayKey } from '../home/calendar'
import { useDraft } from '../workout/draftStore'
import { useProfile, useSetUnit } from './api'
import { saveFile, workoutsToCsv } from './csv'

const UNITS: Unit[] = ['kg', 'lb']

/** The account sheet behind the "Me" tab: settings, body weight, export, log out. */
export function MeSheetBody({ onLogOut, onClose }: { onLogOut: () => void; onClose: () => void }) {
  const email = useAuth().session?.user.email
  return (
    <div className="stack me-sheet">
      {email && <p className="muted">{email}</p>}
      <UnitSetting />
      <RestPushSetting />
      {/* The sheet is a dialog over the page: close it, or it stays on top of the new one. */}
      <Link className="btn block" to="/body-weight" onClick={onClose}>
        Body weight
      </Link>
      <YourData />
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

function YourData() {
  const unit = useProfile().data?.unit ?? 'kg'
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  async function workoutsFile(): Promise<PreparedFile> {
    const workouts = await fetchAllWorkouts()
    const sets = workouts.reduce(
      (n, w) => n + w.workout_exercises.reduce((m, we) => m + we.sets.length, 0),
      0,
    )
    return {
      file: csvFile(
        workoutsToCsv(workouts, unit),
        `gym-tracker-${new Date().toISOString().slice(0, 10)}.csv`,
      ),
      summary: `${plural(sets, 'set')}, weights in ${unit}.`,
    }
  }

  async function bodyWeightFile(): Promise<PreparedFile> {
    const entries = await fetchBodyWeights()
    return {
      file: csvFile(
        bodyWeightsToCsv(entries, unit),
        `gym-tracker-body-weight-${dayKey(new Date())}.csv`,
      ),
      summary: `${plural(entries.length, 'weigh-in')}, in ${unit}.`,
    }
  }

  return (
    <section className="stack me-section" aria-labelledby="export-heading">
      <h3 id="export-heading">Your data</h3>
      <CsvExport label="Export workouts (CSV)" prepare={workoutsFile} />
      <CsvExport label="Export body weight (CSV)" prepare={bodyWeightFile} />
    </section>
  )
}

const csvFile = (csv: string, name: string) => new File([csv], name, { type: 'text/csv' })

interface PreparedFile {
  file: File
  /** What is in it, shown under the Save button. */
  summary: string
}

type ExportState =
  | { step: 'idle' }
  | { step: 'loading' }
  | ({ step: 'ready' } & PreparedFile)
  | { step: 'done' }
  | { step: 'error'; message: string }

/**
 * Two taps on purpose: the first loads the data, the second hands the file
 * over. iOS only opens the share sheet straight from a tap, and loading a
 * long history can take longer than Safari keeps that tap "fresh".
 */
function CsvExport({ label, prepare }: { label: string; prepare: () => Promise<PreparedFile> }) {
  const [state, setState] = useState<ExportState>({ step: 'idle' })

  async function load() {
    setState({ step: 'loading' })
    try {
      setState({ step: 'ready', ...(await prepare()) })
    } catch (e) {
      setState({ step: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  // Cancelling the share sheet keeps the file ready for another try.
  async function save(file: File) {
    if ((await saveFile(file)) === 'saved') setState({ step: 'done' })
  }

  return (
    <div className="stack">
      {state.step === 'ready' ? (
        <>
          <button type="button" className="btn block primary" onClick={() => save(state.file)}>
            Save {state.file.name}
          </button>
          <p className="muted small-text">{state.summary}</p>
        </>
      ) : (
        <button
          type="button"
          className="btn block"
          onClick={load}
          disabled={state.step === 'loading'}
        >
          {state.step === 'loading' ? 'Preparing…' : label}
        </button>
      )}
      {state.step === 'done' && <p className="muted small-text">Exported.</p>}
      {state.step === 'error' && (
        <p role="alert" className="error small-text">
          Export failed: {state.message}
        </p>
      )}
    </div>
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
    // The next account on this phone must turn alerts on for itself. Best
    // effort: no signal must not block logging out.
    await turnOffRestPush().catch(reportError)
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
