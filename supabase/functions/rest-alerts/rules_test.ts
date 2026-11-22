import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1.0.13'
import { isGone, isStale, pushRefusalReason, sameSecret, thrownName } from './rules.ts'

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

Deno.test("a refused push logs the service's reason code, nothing else from the body", () => {
  assertEquals(pushRefusalReason('{"reason":"BadJwtToken"}'), 'BadJwtToken')
  assertEquals(pushRefusalReason('{"reason":"VapidPkHashMismatch"}'), 'VapidPkHashMismatch')
  assertEquals(pushRefusalReason('<html>Bad Request</html>'), 'no reason given')
  assertEquals(pushRefusalReason(''), 'no reason given')
  assertEquals(pushRefusalReason('null'), 'no reason given')
  assertEquals(pushRefusalReason('{"reason":42}'), 'no reason given')
  // Anything that is not a plain code could carry data back: dropped.
  assertEquals(
    pushRefusalReason('{"reason":"bad endpoint https://web.push.apple.com/x"}'),
    'no reason given',
  )
})

Deno.test('a push that threw logs only the error name', () => {
  assertEquals(thrownName(new SyntaxError('Unexpected token in {"d":"secret"}')), 'SyntaxError')
  assertEquals(thrownName(new DOMException('timed out', 'TimeoutError')), 'TimeoutError')
  assertEquals(thrownName('boom'), 'non-Error')
})
