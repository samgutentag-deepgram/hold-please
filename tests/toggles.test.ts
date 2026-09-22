import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBus } from '../src/bus/events.ts'
import { DEFAULT_TOGGLES, ToggleStore, keytermsFromEnv, validateToggle } from '../src/toggles/state.ts'
import { fluxParamsFor, sttModelFor } from '../src/call.ts'

test('eager above eot is unreachable, in either order', () => {
  const t = { ...DEFAULT_TOGGLES }
  const up = validateToggle(t, 'eagerEotThreshold', 0.8)
  assert.equal(up.ok, false)
  const down = validateToggle({ ...t, eagerEotThreshold: 0.6 }, 'eotThreshold', 0.5)
  assert.equal(down.ok, false)
  assert.equal(validateToggle(t, 'eagerEotThreshold', 0.7).ok, true, 'equal is allowed')
})

test('unknown names, wrong types, and out-of-range values are rejected with a reason', () => {
  const t = { ...DEFAULT_TOGGLES }
  assert.match((validateToggle(t, 'turbo', true) as { reason: string }).reason, /unknown/)
  assert.match((validateToggle(t, 'smartEot', 'yes') as { reason: string }).reason, /boolean/)
  assert.match((validateToggle(t, 'eotTimeoutMs', 100) as { reason: string }).reason, /between/)
  assert.match((validateToggle(t, 'eotThreshold', Number.NaN) as { reason: string }).reason, /finite/)
})

test('the store emits toggle.changed once per real change and notifies listeners', () => {
  const bus = createBus()
  const store = new ToggleStore(bus)
  const seen: string[] = []
  const off = store.onChange((_next, changed) => seen.push(changed))
  assert.equal(store.set('keyterms', true).ok, true)
  assert.equal(store.set('keyterms', true).ok, true, 'a no-op set is fine')
  assert.equal(store.set('eagerEotThreshold', 0.95).ok, false)
  off()
  store.set('smartEot', true)
  assert.deepEqual(seen, ['keyterms'])
  assert.deepEqual(bus.log.map((e) => e.kind), ['toggle.changed', 'toggle.changed'])
  assert.equal(store.get().smartEot, true)
})

test('keyterms are independent of turn detection, and eager rides on smartEot', () => {
  const terms = ['A7', '4K']
  // Beat 2 lands at 5:00 and beat 4 at 12:00, so keyterms have to work while the silence timer
  // is still running. They change transcription, not turn detection. Unbundled 2026-09-22.
  const keytermsOnly = fluxParamsFor({ ...DEFAULT_TOGGLES, keyterms: true }, 'flux-general-en', terms)
  assert.deepEqual(keytermsOnly.keyterms, terms)
  assert.equal(keytermsOnly.eagerEotThreshold, undefined, 'no speculation without smartEot')

  const both = fluxParamsFor(
    { ...DEFAULT_TOGGLES, keyterms: true, eagerEot: true, smartEot: true }, 'flux-general-en', terms)
  assert.deepEqual(both.keyterms, terms)
  assert.equal(both.eagerEotThreshold, 0.5)

  assert.equal(sttModelFor({ ...DEFAULT_TOGGLES, multilingual: true }, 'flux-general-en'), 'flux-general-multi')
})

test('every switch defaults off, so the naive agent is the starting state', () => {
  // The stage rule: nothing is ever turned OFF to fix something. Each beat turns one thing ON.
  assert.equal(DEFAULT_TOGGLES.bargeIn, false)
  assert.equal(DEFAULT_TOGGLES.keyterms, false)
  assert.equal(DEFAULT_TOGGLES.eagerEot, false)
  assert.equal(DEFAULT_TOGGLES.smartEot, false)
  assert.equal(DEFAULT_TOGGLES.multilingual, false)
})

test('eager cannot be armed before smart end of turn, in either order', () => {
  const off = { ...DEFAULT_TOGGLES }
  const bad = validateToggle(off, 'eagerEot', true)
  assert.equal(bad.ok, false)
  assert.match(bad.ok === false ? bad.reason : '', /smartEot/)

  const smart = validateToggle(off, 'smartEot', true)
  assert.equal(smart.ok, true)
  const good = validateToggle(smart.ok ? smart.toggles : off, 'eagerEot', true)
  assert.equal(good.ok, true)

  // And turning smart back off while eager is on is refused rather than silently allowed.
  const stillOn = good.ok ? good.toggles : off
  assert.equal(validateToggle(stillOn, 'smartEot', false).ok, false)
})

test('keyterms come from the env when set, with a sensible default', () => {
  assert.deepEqual(keytermsFromEnv('A7, 4K ,, Q'), ['A7', '4K', 'Q'])
  assert.ok(keytermsFromEnv(undefined).includes('Gutentag'))
  assert.ok(keytermsFromEnv('  ,  ').length > 0)
})
