import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

type Mode = 'signin' | 'signup' | 'forgot'

const MIN_PASSWORD = 8

/**
 * Email + password, entirely inside the app.
 * On iOS, a PWA added to the home screen has its own storage, separate from Safari.
 * Anything that relies on an email link (magic link) would log in Safari, not the
 * installed app. Passwords also get Keychain autofill, which makes login one tap.
 */
export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const trimmed = email.trim()

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password })
        // On success onAuthStateChange sets the session and the Navigate above takes over.
        if (error) setError(error.message)
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: trimmed, password })
        if (error) setError(error.message)
        // No session = "Confirm email" is on in Supabase: the user must click the link first.
        else if (!data.session) {
          setInfo('Account created. Open the confirmation email, then come back here and sign in.')
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) setError(error.message)
        // Same message whether or not the account exists, so the form cannot be used
        // to find out which emails are registered.
        else setInfo('If this email has an account, a reset link is on its way.')
      }
    } finally {
      setBusy(false)
    }
  }

  const title = { signin: 'Sign in', signup: 'Create account', forgot: 'Reset password' }[mode]

  return (
    <main className="page login">
      <h1>Gym Tracker</h1>
      <h2>{title}</h2>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {mode !== 'forgot' && (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              // Tells iOS Keychain whether to fill a saved password or suggest a new one.
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button className="btn primary" disabled={busy}>
          {busy ? 'Please wait…' : title}
        </button>
      </form>

      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {info && <p role="status">{info}</p>}

      <div className="stack">
        {mode === 'signin' && (
          <>
            <button type="button" className="btn ghost" onClick={() => switchMode('forgot')}>
              Forgot password?
            </button>
            <button type="button" className="btn ghost" onClick={() => switchMode('signup')}>
              No account? Create one
            </button>
          </>
        )}
        {mode !== 'signin' && (
          <button type="button" className="btn ghost" onClick={() => switchMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>
    </main>
  )
}
