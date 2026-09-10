// Probe: does a keyterm change how Flux spells a word? Synthesize with Flux TTS, transcribe with
// Flux STT, with and without keyterms. No microphone involved.
//
//   node --env-file=.env scripts/keyterm-probe.mjs "I live on Tuolumne Street."
//   AUDIO=recordings/...-caller.wav node --env-file=.env scripts/keyterm-probe.mjs
//
// With AUDIO set, the file (16 kHz mono 16-bit WAV or raw PCM) is transcribed instead of a phrase,
// so a real caller's recording can be tested against the same keyterm list.
import { WebSocket } from 'ws'
import { readFileSync } from 'node:fs'
const key = process.env.DEEPGRAM_API_KEY
const phrases = process.argv.slice(2)
const H = { Authorization: `Token ${key}` }

function synth(text, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://api.deepgram.com/v2/speak?model=${voice}&encoding=linear16&sample_rate=16000`, { headers: H })
    const chunks = []
    ws.on('open', () => { ws.send(JSON.stringify({ type: 'Speak', text })); ws.send(JSON.stringify({ type: 'Flush' })) })
    ws.on('message', (d, bin) => { if (bin) chunks.push(d); else { const m = JSON.parse(d.toString()); if (m.type === 'SpeechMetadata') { ws.send(JSON.stringify({ type: 'Close' })) } if (m.type === 'Error') reject(new Error(m.description)) } })
    ws.on('close', () => resolve(Buffer.concat(chunks)))
    ws.on('error', reject)
  })
}

function transcribe(pcm, keyterms) {
  return new Promise((resolve, reject) => {
    const u = new URL('wss://api.deepgram.com/v2/listen')
    u.searchParams.set('model', 'flux-general-en'); u.searchParams.set('encoding', 'linear16'); u.searchParams.set('sample_rate', '16000')
    u.searchParams.set('eot_timeout_ms', '1500')
    for (const k of keyterms) u.searchParams.append('keyterm', k)
    const ws = new WebSocket(u, { headers: H })
    const finals = []
    ws.on('open', async () => {
      // pad with a second of silence so the turn closes, then stream in 20 ms frames at 4x speed
      const audio = Buffer.concat([pcm, Buffer.alloc(16000 * 2 * 2)])
      for (let i = 0; i < audio.length; i += 6400) { ws.send(audio.subarray(i, i + 6400)); await new Promise(r => setTimeout(r, 20)) }
      ws.send(JSON.stringify({ type: 'CloseStream' }))
    })
    ws.on('message', (d, bin) => { if (bin) return; const m = JSON.parse(d.toString()); if (m.type === 'TurnInfo' && m.event === 'EndOfTurn' && m.transcript) finals.push(m.transcript); if (m.type === 'Error') reject(new Error(m.description)) })
    ws.on('close', () => resolve(finals.join(' | ')))
    ws.on('error', reject)
  })
}

// KEYTERMS=Gough,Kearny node scripts/keyterm-probe.mjs "..."  overrides the list under test.
const KEYTERMS = (process.env.KEYTERMS ?? 'Tuolumne,Tuolumne Street,Gutentag,Harbor Light Electric').split(',').map((s) => s.trim()).filter(Boolean)
if (process.env.AUDIO) {
  let pcm = readFileSync(process.env.AUDIO)
  if (pcm.subarray(0, 4).toString() === 'RIFF') pcm = pcm.subarray(44)
  const off = await transcribe(pcm, [])
  const on = await transcribe(pcm, KEYTERMS)
  console.log(`${process.env.AUDIO}\n  keyterms off: ${off}\n  keyterms on : ${on}`)
  process.exit(0)
}
for (const phrase of phrases) {
  for (const voice of (process.env.VOICES ?? 'flux-haley-en,flux-marcus-en').split(',')) {
    const pcm = await synth(phrase, voice)
    const off = await transcribe(pcm, [])
    const on = await transcribe(pcm, KEYTERMS)
    console.log(`${voice.padEnd(16)} | "${phrase}"\n  keyterms off: ${off}\n  keyterms on : ${on}`)
  }
}
