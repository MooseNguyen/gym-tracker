import { useEffect, useState } from 'react'
import { reportError } from '../../lib/monitoring'
import {
  refreshRestPush,
  turnOffRestPush,
  turnOnRestPush,
  useRestPushState,
  type RestPushState,
} from './restPush'

/** The "Rest timer alerts" section of the Me sheet. Applies to this phone only. */
export function RestPushSetting() {
  const state = useRestPushState()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Permission can change in the phone's Settings while the app is open.
  useEffect(() => {
    refreshRestPush().catch(reportError)
  }, [])

  async function toggle(on: boolean) {
    setBusy(true)
    setError(null)
    try {
      await (on ? turnOnRestPush() : turnOffRestPush())
    } catch (e) {
      reportError(e)
      setError(
        on
          ? 'Could not turn alerts on. Check your connection and try again.'
          : 'Could not turn alerts off. Check your connection and try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  const canToggle = state === 'on' || state === 'off'

  return (
    <section className="stack me-section" aria-labelledby="rest-push-heading">
      <h3 id="rest-push-heading">Rest timer alerts</h3>
      {canToggle && (
        <div className="segmented" role="group" aria-labelledby="rest-push-heading">
          {(['off', 'on'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={option === state ? 'on' : ''}
              aria-pressed={option === state}
              disabled={busy}
              onClick={() => option !== state && toggle(option === 'on')}
            >
              {option === 'on' ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      )}
      <p className="muted small-text">{HINTS[state]}</p>
      {error && (
        <p role="alert" className="error small-text">
          {error}
        </p>
      )}
    </section>
  )
}

const HINTS: Record<RestPushState, string> = {
  checking: 'Checking this phone…',
  unsupported: 'This browser cannot show notifications.',
  'install-first':
    'On iPhone, add the app to your Home Screen first (Share → Add to Home Screen), then turn alerts on from there.',
  denied:
    'Notifications are blocked for this app. Allow them in the phone’s Settings → Notifications, then come back.',
  off: 'A notification when the rest is over, even with the phone locked. This phone only.',
  on: 'A notification when the rest is over, even with the phone locked. It can arrive up to about 5 seconds after the timer.',
}
