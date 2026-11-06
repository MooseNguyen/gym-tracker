import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import { setDraftOwner } from '../workout/draftStore'

interface AuthState {
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    const apply = (session: Session | null) => {
      // Switch the draft before the session, so no render pairs user B with A's draft.
      setDraftOwner(session?.user.id ?? null)
      setState({ session, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      // Never show one user's cached data to the next user on this device.
      if (event === 'SIGNED_OUT') queryClient.clear()
      apply(session)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
