// Probe: what does flux-general-multi report per turn and per word? Synthesize a phrase with Flux
// TTS, stream it to the multilingual model, and dump the raw EndOfTurn message.
import { WebSocket } from 'ws'
const key = process.env.DEEPGRAM_API_KEY
const H = { Authorization: `Token ${key}` }
const phrase = process.argv[2] ?? 'Guten Tag, my name is Sam Gutentag and I live on Ygnacio Valley Road.'

const pcm = await new Promise((resolve, reject) => {
  const ws = new WebSocket('wss://api.deepgram.com/v2/speak?model=flux-haley-en&encoding=linear16&sample_rate=16000', { headers: H })
  const chunks = []
  ws.on('open', () => { ws.send(JSON.stringify({ type: 'Speak', text: phrase })); ws.send(JSON.stringify({ type: 'Flush' })) })
  ws.on('message', (d, bin) => { if (bin) chunks.push(d); else if (JSON.parse(d.toString()).type === 'SpeechMetadata') ws.send(JSON.stringify({ type: 'Close' })) })
  ws.on('close', () => resolve(Buffer.concat(chunks))); ws.on('error', reject)
})

const u = new URL('wss://api.deepgram.com/v2/listen')
u.searchParams.set('model', 'flux-general-multi'); u.searchParams.set('encoding', 'linear16'); u.searchParams.set('sample_rate', '16000'); u.searchParams.set('eot_timeout_ms', '1500')
const ws = new WebSocket(u, { headers: H })
ws.on('open', async () => {
  const audio = Buffer.concat([pcm, Buffer.alloc(16000 * 2 * 2)])
  for (let i = 0; i < audio.length; i += 640) { ws.send(audio.subarray(i, i + 640)); await new Promise(r => setTimeout(r, 5)) }
  ws.send(JSON.stringify({ type: 'CloseStream' }))
})
ws.on('message', (d, bin) => {
  if (bin) return
  const m = JSON.parse(d.toString())
  if (m.type === 'TurnInfo' && (m.event === 'EndOfTurn' || m.event === 'StartOfTurn')) {
    console.log(m.event, JSON.stringify({ transcript: m.transcript, languages: m.languages, languages_hinted: m.languages_hinted, firstWords: m.words.slice(0, 4) }, null, 1))
  }
  if (m.type === 'Error') console.error('error', m)
})
ws.on('close', () => process.exit(0))
