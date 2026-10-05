import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reconcileHeard } from '../src/agent/loop.ts'

test('reconcileHeard cuts the reply that was playing and marks queued ones unheard', () => {
  const history = [
    { role: 'user' as const, content: 'What happens at his exam?' },
    { role: 'assistant' as const, content: 'At his first visit the vet checks his weight. Then the vaccines.' },
    { role: 'user' as const, content: 'Can we just sign him up?' },
    { role: 'assistant' as const, content: 'Sure, Thursday or Friday?' },
  ]
  assert.equal(reconcileHeard(history, 0, 'At his first visit the vet'), true)
  assert.equal(history[1]!.content, 'At his first visit the vet')
  assert.equal(history[3]!.content, '(interrupted before saying anything)')
})

test('reconcileHeard leaves history alone when nothing matches', () => {
  const history = [{ role: 'assistant' as const, content: 'Hello Otto.' }]
  assert.equal(reconcileHeard(history, 0, 'Something else entirely'), false)
  assert.equal(history[0]!.content, 'Hello Otto.')
})
