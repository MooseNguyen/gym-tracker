import { NavLink, Outlet } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useDraft } from '../../features/workout/draftStore'

export function Layout() {
  const draft = useDraft()
  return (
    <div className="app">
      <div className="content">
        <Outlet />
      </div>
      <nav className="tabbar" aria-label="Main">
        <NavLink to="/" end>
          Workout
        </NavLink>
        {draft && <NavLink to="/workout">● Active</NavLink>}
        <NavLink to="/history">History</NavLink>
        <NavLink to="/exercises">Exercises</NavLink>
        <button
          className="link"
          onClick={() => {
            if (
              draft &&
              !confirm(
                'You have an unfinished workout on this phone. It stays saved here. Log out?',
              )
            )
              return
            supabase.auth.signOut()
          }}
        >
          Log out
        </button>
      </nav>
    </div>
  )
}
