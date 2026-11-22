import { useEffect, useRef } from 'react'
import { reportError } from '../../lib/monitoring'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { useDraft } from '../workout/draftStore'
import { refreshRestPush, useRestPushState } from './restPush'
import { alertWrite, type AlertWrite } from './restPushRules'

/**
 * Mirrors the running rest's end into rest_alerts, so the server can push
 * "Rest over" while the phone is locked. Rendered once, in the signed-in
 * layout; draws nothing.
 *
 * No retry on failure, on purpose: a rest is over within minutes, and the
 * server drops alerts more than a minute late anyway. The in-app timer keeps
 * working either way.
 */
export function RestAlertSync() {
  const userId = useAuth().session?.user.id
  const restEndsAt = useDraft()?.restEndsAt ?? null
  const pushOn = useRestPushState() === 'on'
  const prev = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    refreshRestPush().catch(reportError)
  }, [userId])

  useEffect(() => {
    if (!pushOn || !userId) {
      // Next time it is on, start from "unknown" so a running rest is saved.
      prev.current = undefined
      return
    }
    const write = alertWrite(prev.current, restEndsAt, Date.now())
    prev.current = restEndsAt
    if (write) queue(userId, write)
  }, [userId, restEndsAt, pushOn])

  return null
}

// One write at a time, in order: three quick +15 taps must leave the last
// end on the server, not whichever request happened to land last.
let chain: Promise<void> = Promise.resolve()

function queue(userId: string, write: NonNullable<AlertWrite>) {
  chain = chain.then(() => send(userId, write)).catch(reportError)
}

async function send(userId: string, write: NonNullable<AlertWrite>) {
  if (write.kind === 'save') {
    unwrap(
      await supabase
        .from('rest_alerts')
        .upsert(
          { user_id: userId, fire_at: write.fireAt, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        ),
    )
  } else {
    unwrap(await supabase.from('rest_alerts').delete().eq('user_id', userId))
  }
}
