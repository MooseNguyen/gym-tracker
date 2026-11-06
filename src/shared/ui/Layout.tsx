import { useLayoutEffect, useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useDraft } from '../../features/workout/draftStore'
import { Dialog } from './Dialog'

// Inline 24px stroke icons: five small paths don't justify an icon library.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

const icons = {
  workout: (
    <Icon>
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
    </Icon>
  ),
  active: (
    <Icon>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2M10 2h4" />
    </Icon>
  ),
  history: (
    <Icon>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </Icon>
  ),
  exercises: (
    <Icon>
      <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />
    </Icon>
  ),
  logout: (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Icon>
  ),
}

export function Layout() {
  const draft = useDraft()
  const { pathname } = useLocation()
  const [confirmingLogout, setConfirmingLogout] = useState(false)

  // BrowserRouter keeps the window scroll position across navigations, so
  // "Start" near the bottom of Home used to open the workout half-way down.
  // Every new page starts at the top (useLayoutEffect: before it paints).
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="app">
      <div className="content">
        <Outlet />
      </div>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end>
          {icons.workout}
          Workout
        </NavLink>
        {/* Always present, so the bar never shifts; the dot shows a workout in progress. */}
        <NavLink
          to="/workout"
          aria-label={draft ? 'Active workout (in progress)' : 'Active workout'}
        >
          <span className={draft ? 'tab-icon tab-live' : 'tab-icon'}>{icons.active}</span>
          Active
        </NavLink>
        <NavLink to="/history">
          {icons.history}
          History
        </NavLink>
        <NavLink to="/exercises">
          {icons.exercises}
          Exercises
        </NavLink>
        <button type="button" onClick={() => setConfirmingLogout(true)}>
          {icons.logout}
          Log out
        </button>
      </nav>

      <Dialog open={confirmingLogout} onClose={() => setConfirmingLogout(false)} title="Log out?">
        <LogoutConfirm hasDraft={!!draft} onCancel={() => setConfirmingLogout(false)} />
      </Dialog>
    </div>
  )
}

/** Body of the log-out dialog. A failed sign-out keeps the dialog open with the reason. */
function LogoutConfirm({ hasDraft, onCancel }: { hasDraft: boolean; onCancel: () => void }) {
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
