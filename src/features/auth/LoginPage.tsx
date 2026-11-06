import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useAuth } from './AuthProvider'

/**
 * Email + 6-digit code instead of a magic link.
 * On iOS, a PWA added to the home screen has its own storage, separate from Safari.
 * A magic link opens in Safari, so the session would land in Safari and the
 * installed app would stay logged out. Typing a code keeps everything in the PWA.
 */
export function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/'
    return <Navigate to={from} replace />
  }

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    // On success onAuthStateChange updates the session and the Navigate above takes over.
    if (error) setError(error.message)
  }

  return (
    <main className="page login">
      <h1>Gym Tracker</h1>
      {step === 'email' ? (
        <form onSubmit={sendCode} className="stack">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Sending…' : 'Send login code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="stack">
          <p className="muted">We sent a code to {email}.</p>
          <label className="field">
            <span>Code</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Checking…' : 'Log in'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setStep('email')}>
            Use another email
          </button>
        </form>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </main>
  )
}
