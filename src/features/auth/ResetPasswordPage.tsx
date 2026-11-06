import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

/**
 * Target of the reset-password email link. supabase-js reads the recovery token
 * from the URL and creates a short-lived session, which allows updateUser().
 * This page usually opens in Safari, not in the installed app, which is fine:
 * it only sets the password. The user then signs in from the app.
 */
export function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else setDone(true)
  }

  if (loading) return <p className="muted center">Loading…</p>

  return (
    <main className="page login">
      <h1>New password</h1>
      {done ? (
        <div className="stack">
          <p role="status">Password updated. Open Gym Tracker from your home screen and sign in.</p>
          <Link className="btn" to="/">
            Continue here
          </Link>
        </div>
      ) : !session ? (
        <div className="stack">
          <p className="error">This reset link is invalid or has expired.</p>
          <Link className="btn" to="/login">
            Request a new one
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="stack">
          <label className="field">
            <span>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      )}
    </main>
  )
}
