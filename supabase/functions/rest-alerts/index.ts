// Sends "Rest over" Web Push notifications. Called only by the pg_cron job
// private.send_due_rest_alerts() (see migration 20261123000000_rest_push.sql),
// and only when an alert is due. Deployed with --no-verify-jwt: the caller is
// the database, not a signed-in user, so the shared x-cron-secret header is
// the check.
//
// Secrets (supabase secrets set, never in git):
//   REST_ALERTS_SECRET  same value as the Vault secret rest_alerts_secret
//   VAPID_PRIVATE_JWK   private key from `npx @pushforge/builder vapid` (JSON)
//   VAPID_CONTACT       mailto: address the push services can reach
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { buildPushHTTPRequest } from '@pushforge/builder'
import { createClient } from '@supabase/supabase-js'
import {
  isGone,
  isStale,
  pushRefusalReason,
  REST_OVER_PAYLOAD,
  sameSecret,
  thrownName,
} from './rules.ts'

interface DueAlert {
  user_id: string
  fire_at: string
}

/** What the push service answered; `reason` only when it refused. */
interface PushOutcome {
  status: number
  reason?: string
}

interface Subscription {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Apple's and Google's push services answer in well under a second; a hung one must not hold the others. */
const PUSH_TIMEOUT_MS = 4000

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 })

  const secret = Deno.env.get('REST_ALERTS_SECRET')
  if (!secret || !sameSecret(req.headers.get('x-cron-secret') ?? '', secret)) {
    return new Response(null, { status: 401 })
  }

  const vapidKey = Deno.env.get('VAPID_PRIVATE_JWK')
  const contact = Deno.env.get('VAPID_CONTACT')
  if (!vapidKey || !contact) {
    console.error('rest-alerts: VAPID_PRIVATE_JWK or VAPID_CONTACT is not set')
    return new Response(null, { status: 500 })
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    {
      auth: { persistSession: false },
    },
  )

  // Deleting is how a run claims the due alerts: the rows come back to this
  // run only, so a second run that overlaps it (every 5 s) cannot send them
  // again.
  const now = Date.now()
  const { data: claimed, error: claimError } = await db
    .from('rest_alerts')
    .delete()
    .lte('fire_at', new Date(now).toISOString())
    .select('user_id, fire_at')
  if (claimError) {
    console.error('rest-alerts: claiming due alerts failed', claimError.message)
    return new Response(null, { status: 500 })
  }
  // The client is untyped here (the app's generated types live outside the
  // function's bundle); the select above fixes the shape.
  const due = claimed as DueAlert[]

  const users = due.filter((a) => !isStale(a.fire_at, now)).map((a) => a.user_id)
  if (users.length === 0) return Response.json({ sent: 0, dropped: due.length })

  const { data: subRows, error: subsError } = await db
    .from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', users)
  if (subsError) {
    console.error('rest-alerts: reading subscriptions failed', subsError.message)
    return new Response(null, { status: 500 })
  }
  const subscriptions = subRows as Subscription[]

  const results = await Promise.allSettled(subscriptions.map((s) => send(s, vapidKey, contact)))

  const gone = subscriptions.filter((_, i) => {
    const r = results[i]
    return r.status === 'fulfilled' && isGone(r.value.status)
  })
  for (const s of gone) {
    await db.from('push_subscriptions').delete().match({ user_id: s.user_id, endpoint: s.endpoint })
  }

  // Why each failed push failed: an HTTP status with the service's reason
  // code, or the name of what threw. Never endpoints (they identify a
  // person's phone) or error messages (see thrownName).
  const failures = results.flatMap((r) => {
    if (r.status === 'rejected') return [thrownName(r.reason)]
    const { status, reason } = r.value
    return status < 300 || isGone(status) ? [] : [`${status} ${reason}`]
  })
  const sent = results.length - gone.length - failures.length
  if (failures.length > 0) {
    console.error(
      `rest-alerts: ${failures.length} of ${results.length} pushes failed: ${failures.join(', ')}`,
    )
  }
  return Response.json({
    sent,
    gone: gone.length,
    failed: failures.length,
    dropped: due.length - users.length,
  })
})

async function send(
  s: Subscription,
  privateJWK: string,
  adminContact: string,
): Promise<PushOutcome> {
  const { endpoint, headers, body } = await buildPushHTTPRequest({
    privateJWK,
    subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
    message: {
      payload: REST_OVER_PAYLOAD,
      adminContact,
      // A rest alert is worthless a minute later; "high" wakes a locked phone at once.
      options: { ttl: 60, urgency: 'high', topic: 'rest-over' },
    },
  })
  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  })
  if (res.ok) {
    await res.body?.cancel()
    return { status: res.status }
  }
  return { status: res.status, reason: pushRefusalReason(await res.text()) }
}
