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
  assert.match((validateToggle(t, 'naiveMode', 'yes') as { reason: string }).reason, /boolean/)
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
  store.set('naiveMode', true)
  assert.deepEqual(seen, ['keyterms'])
  assert.deepEqual(bus.log.map((e) => e.kind), ['toggle.changed', 'toggle.changed'])
  assert.equal(store.get().naiveMode, true)
})

test('naive mode strips keyterms and eager from what Flux is told, and multilingual swaps the model', () => {
  const terms = ['A7', '4K']
  const fixed = fluxParamsFor({ ...DEFAULT_TOGGLES, keyterms: true, eagerEot: true }, 'flux-general-en', terms)
  assert.deepEqual(fixed.keyterms, terms)
  assert.equal(fixed.eagerEotThreshold, 0.5)
  const naive = fluxParamsFor({ ...DEFAULT_TOGGLES, keyterms: true, eagerEot: true, naiveMode: true }, 'flux-general-en', terms)
  assert.deepEqual(naive.keyterms, [])
  assert.equal(naive.eagerEotThreshold, undefined)
  assert.equal(sttModelFor({ ...DEFAULT_TOGGLES, multilingual: true }, 'flux-general-en'), 'flux-general-multi')
})

test('keyterms come from the env when set, with a sensible default', () => {
  assert.deepEqual(keytermsFromEnv('A7, 4K ,, Q'), ['A7', '4K', 'Q'])
  assert.ok(keytermsFromEnv(undefined).includes('Gutentag'))
  assert.ok(keytermsFromEnv('  ,  ').length > 0)
})
