import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CARD_LIMITS, codeCards } from '../src/toggles/cards.ts'
import { DEFAULT_TOGGLES } from '../src/toggles/state.ts'
import { keytermsFromEnv } from '../src/toggles/state.ts'

const root = new URL('../', import.meta.url)
const cards = codeCards(keytermsFromEnv(undefined))

test('every boolean switch on the dashboard has a card', () => {
  const switches = Object.entries(DEFAULT_TOGGLES).filter(([, v]) => typeof v === 'boolean').map(([k]) => k)
  assert.deepEqual(Object.keys(cards).sort(), switches.sort())
})

test('every card points at code that still exists', () => {
  for (const [name, card] of Object.entries(cards)) {
    const source = readFileSync(new URL(card.ref.file, root), 'utf8')
    assert.ok(source.includes(card.ref.find), `${name}: "${card.ref.find}" is gone from ${card.ref.file}`)
  }
})

test('every card fits the 15 foot budget', () => {
  for (const [name, card] of Object.entries(cards)) {
    assert.ok(card.lines.length <= CARD_LIMITS.lines, `${name} has ${card.lines.length} lines`)
    assert.ok(card.lines.length >= CARD_LIMITS.minLines, `${name} has only ${card.lines.length} lines`)
    for (const line of card.lines) {
      assert.ok(line.text.length <= CARD_LIMITS.chars, `${name}: "${line.text}" is ${line.text.length} chars`)
    }
  }
})

test('every card says when you want it on and when off, in one short line each', () => {
  for (const [name, card] of Object.entries(cards)) {
    for (const side of ['on', 'off'] as const) {
      const text = card.when[side]
      assert.ok(text.trim().length > 0, `${name}: empty when.${side}`)
      assert.ok(text.length <= CARD_LIMITS.whenChars, `${name}: when.${side} is ${text.length} chars`)
      assert.ok(!text.includes('\u2014'), `${name}: when.${side} has an em dash`)
    }
  }
})

test('the keyterms card shows the keyterms the socket is actually sent', () => {
  const text = codeCards(['Otto', 'Gutentag']).keyterms.lines.map((l) => l.text).join('\n')
  assert.match(text, /'Otto'/)
  assert.match(text, /'Gutentag'/)
})
