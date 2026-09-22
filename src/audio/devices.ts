import { spawn } from 'node:child_process'

// Audio devices by name instead of by index.
//
// This exists because indices lie. ffmpeg has two device lists with two different numberings:
// avfoundation for inputs, CoreAudio for outputs, and the CoreAudio one mixes inputs and outputs
// together. Both renumber when you plug something in. A pinned index has already broken this
// build twice: a speaker index that drifted onto a microphone and killed the process, and a
// microphone pinned to an Elgato that was not plugged in. On stage, on a strange desk, it would
// break again.
//
// So a device spec can be a name. "EarPods" finds the EarPods whatever number it is today.

export interface AudioDevice {
  index: number
  name: string
  /** CoreAudio only. The EarPods output reports a null name, so the UID is the only handle. */
  uid?: string
}

/** Lines look like: `[AVFoundation indev @ 0x..] [3] EarPods Microphone`, after the audio header. */
export function parseInputDevices(stderr: string): AudioDevice[] {
  const devices: AudioDevice[] = []
  let inAudio = false
  for (const line of stderr.split('\n')) {
    if (line.includes('AVFoundation audio devices:')) {
      inAudio = true
      continue
    }
    if (line.includes('AVFoundation video devices:')) {
      inAudio = false
      continue
    }
    if (!inAudio) continue
    const m = /\[(\d+)\]\s+(.*?)\s*$/.exec(line.replace(/^\[AVFoundation[^\]]*\]\s*/, ''))
    if (m) devices.push({ index: Number(m[1]), name: m[2] ?? '' })
  }
  return devices
}

/** Lines look like: `[AudioToolbox @ 0x..] [2]    (null), AppleUSBAudioEngine:Apple, Inc.:EarPods:..` */
export function parseOutputDevices(stderr: string): AudioDevice[] {
  const devices: AudioDevice[] = []
  for (const line of stderr.split('\n')) {
    const m = /\[(\d+)\]\s+(.*)$/.exec(line.replace(/^\[AudioToolbox[^\]]*\]\s*/, ''))
    if (!m) continue
    const rest = m[2] ?? ''
    const comma = rest.indexOf(', ')
    const name = comma === -1 ? rest.trim() : rest.slice(0, comma).trim()
    const device: AudioDevice = { index: Number(m[1]), name }
    if (comma !== -1) device.uid = rest.slice(comma + 2).trim()
    devices.push(device)
  }
  return devices
}

/**
 * Case-insensitive substring match on the name, then on the UID. The UID fallback is what makes
 * "EarPods" resolve the output whose name CoreAudio reports as "(null)".
 */
export function matchDevice(devices: readonly AudioDevice[], query: string): AudioDevice | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  return (
    devices.find((d) => d.name.toLowerCase() === q) ??
    devices.find((d) => d.name.toLowerCase().includes(q)) ??
    devices.find((d) => (d.uid ?? '').toLowerCase().includes(q)) ??
    null
  )
}

/** `AppleUSBAudioEngine:Apple, Inc.:EarPods:LDLP93WQNY:1` reads better as `EarPods`. */
function describeUid(uid: string | undefined): string | undefined {
  if (!uid) return undefined
  const parts = uid.split(':').map((p) => p.trim()).filter(Boolean)
  return parts.length >= 3 ? parts[parts.length - 3] : parts[0]
}

function run(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let out = ''
    child.stderr.on('data', (c: Buffer) => {
      out += c.toString()
    })
    // ffmpeg exits non-zero when listing devices. That is expected, not a failure.
    child.on('close', () => resolve(out))
    child.on('error', () => resolve(''))
  })
}

export async function listInputDevices(): Promise<AudioDevice[]> {
  return parseInputDevices(await run(['-hide_banner', '-f', 'avfoundation', '-list_devices', 'true', '-i', '']))
}

export async function listOutputDevices(): Promise<AudioDevice[]> {
  const args = ['-hide_banner', '-f', 'lavfi', '-i', 'anullsrc', '-t', '0.01', '-f', 'audiotoolbox', '-list_devices', 'true', '-']
  return parseOutputDevices(await run(args))
}

/**
 * Turn LOCAL_MIC_DEVICE into an avfoundation input spec.
 * `none:default` and `:N` pass through. Anything else is a name to look up.
 */
export async function resolveMic(spec: string): Promise<{ spec: string; label: string }> {
  const raw = spec.trim()
  if (raw === 'none:default' || /^:?\d+$/.test(raw) || raw.includes(':')) {
    return { spec: raw.startsWith(':') || raw.includes(':') ? raw : `:${raw}`, label: raw }
  }
  const devices = await listInputDevices()
  const hit = matchDevice(devices, raw)
  if (!hit) {
    const known = devices.map((d) => `[${d.index}] ${d.name}`).join(', ')
    console.error(`[local] no microphone matching "${raw}". Falling back to the system default. Known: ${known}`)
    return { spec: 'none:default', label: `system default (no match for "${raw}")` }
  }
  return { spec: `:${hit.index}`, label: `${hit.name} (index ${hit.index})` }
}

/**
 * Turn LOCAL_SPEAKER_DEVICE into a CoreAudio index. `-1` is the system default and passes through.
 */
export async function resolveSpeaker(spec: string): Promise<{ index: number; label: string }> {
  const raw = spec.trim()
  if (/^-?\d+$/.test(raw)) {
    const index = Number(raw)
    return { index, label: index === -1 ? 'system default' : `index ${index}` }
  }
  const all = await listOutputDevices()
  // The CoreAudio list mixes inputs and outputs. "EarPods" matches "EarPods Microphone" at index
  // 3 before it reaches the actual EarPods output at index 2, whose name CoreAudio reports as
  // "(null)" so only its UID identifies it. Drop the obvious inputs before matching.
  const outputs = all.filter((d) => !/microphone|\bmic\b/i.test(d.name))
  const hit = matchDevice(outputs, raw) ?? matchDevice(all, raw)
  const devices = all
  if (!hit) {
    const known = devices.map((d) => `[${d.index}] ${d.name || d.uid}`).join(', ')
    console.error(`[local] no speaker matching "${raw}". Falling back to the system default. Known: ${known}`)
    return { index: -1, label: `system default (no match for "${raw}")` }
  }
  // CoreAudio reports some outputs, the EarPods among them, with the literal name "(null)".
  const named = hit.name && hit.name !== '(null)' ? hit.name : describeUid(hit.uid) ?? 'unnamed'
  return { index: hit.index, label: `${named} (index ${hit.index})` }
}
