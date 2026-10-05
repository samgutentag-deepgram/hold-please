import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCRIPT, matchStep, togglesForStep } from '../src/agent/script.ts'

test('caller lines complete script steps in order, and off-script lines complete none', () => {
  const done = new Set<number>()
  const say = (text: string) => { const s = matchStep(text, done); if (s !== null) done.add(s); return s }
  assert.equal(say('I just adopted a dog.'), 0)
  assert.equal(say("His name's Otto."), 1)
  assert.equal(say('Okay, yeah.'), null)
  assert.equal(say('What happens at his first wellness exam?'), 2)
  assert.equal(say('Sorry, can we just get him signed up?'), 3)
  assert.equal(say('Can he see Dr. Guten Tag?'), 4)
  assert.equal(say('Doctor Gutentag.'), 5)
  assert.equal(say('So, I work from home most days, but on Tuesdays'), 6)
  assert.equal(say('Can I bring him in Friday at ten, actually make it one.'), 7)
  assert.equal(say('¿Tienen algún veterinario que hable español?'), 8)
  assert.equal(done.size, SCRIPT.length)
})

test('a stray word cannot tick a step far ahead', () => {
  assert.equal(matchStep('Friday works', new Set([0, 1])), null)
})

test('each beat starts with its own switch off and every earlier switch on', () => {
  assert.deepEqual(togglesForStep(2), { bargeIn: false, keyterms: false, smartEot: false, eagerEot: false, multilingual: false })
  assert.equal(togglesForStep(3).bargeIn, true)
  assert.deepEqual([togglesForStep(4).bargeIn, togglesForStep(4).keyterms], [true, false])
  assert.equal(togglesForStep(5).keyterms, true)
  assert.deepEqual([togglesForStep(6).smartEot, togglesForStep(7).smartEot], [false, true])
})
