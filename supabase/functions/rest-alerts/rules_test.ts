import { assert, assertFalse } from 'jsr:@std/assert@1.0.13'
import { isGone, isStale, sameSecret } from './rules.ts'

Deno.test('an alert up to a minute late is still sent; later ones are dropped', () => {
  const now = Date.parse('2026-11-23T10:00:00Z')
  assertFalse(isStale('2026-11-23T10:00:00Z', now))
  assertFalse(isStale('2026-11-23T09:59:00Z', now))
  assert(isStale('2026-11-23T09:58:59Z', now))
})

Deno.test('404 and 410 mean the subscription is gone; other failures are kept', () => {
  assert(isGone(404))
  assert(isGone(410))
  assertFalse(isGone(429))
  assertFalse(isGone(500))
})

Deno.test('the cron secret must match exactly', () => {
  assert(sameSecret('s3cret', 's3cret'))
  assertFalse(sameSecret('s3cre', 's3cret'))
  assertFalse(sameSecret('s3cret!', 's3cret'))
  assertFalse(sameSecret('', 's3cret'))
})
