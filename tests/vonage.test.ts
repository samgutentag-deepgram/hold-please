import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAnswerNcco, CONTENT_TYPE } from '../src/telephony/vonage.ts'
import { SAMPLE_RATE } from '../src/audio/leg.ts'

test('the answer NCCO connects the call to our websocket at the configured sample rate with the call id in headers', () => {
  const ncco = buildAnswerNcco({ publicUrl: 'https://demo.ngrok.app', callUuid: 'abc', from: '14155550100', to: '14155550199' }) as Array<Record<string, unknown>>
  assert.equal(ncco.length, 1)
  const connect = ncco[0]!
  assert.equal(connect['action'], 'connect')
  assert.equal(connect['from'], '14155550199')
  assert.deepEqual(connect['eventUrl'], ['https://demo.ngrok.app/webhooks/event'])
  const endpoint = (connect['endpoint'] as Array<Record<string, unknown>>)[0]!
  assert.equal(endpoint['type'], 'websocket')
  assert.equal(endpoint['uri'], 'wss://demo.ngrok.app/ws/vonage')
  assert.equal(endpoint['content-type'], CONTENT_TYPE)
  assert.equal(CONTENT_TYPE, `audio/l16;rate=${SAMPLE_RATE}`)
  assert.deepEqual(endpoint['headers'], { callId: 'abc', caller: '14155550100' })
})
