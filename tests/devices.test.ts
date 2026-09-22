import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchDevice, parseInputDevices, parseOutputDevices } from '../src/audio/devices.ts'

// Real ffmpeg output from Sam's machine, 2026-09-22. Kept verbatim: the shapes are the point.
const INPUTS = `[AVFoundation indev @ 0x1] AVFoundation video devices:
[AVFoundation indev @ 0x1] [0] Elgato Virtual Camera
[AVFoundation indev @ 0x1] [1] MacBook Pro Camera
[AVFoundation indev @ 0x1] AVFoundation audio devices:
[AVFoundation indev @ 0x1] [0] Elgato Wave Link My Mix
[AVFoundation indev @ 0x1] [2] MacBook Pro Microphone
[AVFoundation indev @ 0x1] [3] EarPods Microphone`

const OUTPUTS = `[AudioToolbox @ 0x2] CoreAudio devices:
[AudioToolbox @ 0x2] [1]        Elgato Wave Link My Mix, 78FA4BBC-6F24
[AudioToolbox @ 0x2] [2]                         (null), AppleUSBAudioEngine:Apple, Inc.:EarPods:LDLP93WQNY:1
[AudioToolbox @ 0x2] [3]             EarPods Microphone, AppleUSBAudioEngine:Apple, Inc.:EarPods:LDLP93WQNY:2
[AudioToolbox @ 0x2] [5]           MacBook Pro Speakers, BuiltInSpeakerDevice`

test('input parsing ignores the video list, which shares the numbering', () => {
  const devices = parseInputDevices(INPUTS)
  assert.deepEqual(devices.map((d) => d.index), [0, 2, 3])
  assert.equal(devices.find((d) => d.index === 3)?.name, 'EarPods Microphone')
})

test('output parsing keeps the UID, because the EarPods output has no name', () => {
  const devices = parseOutputDevices(OUTPUTS)
  const earpods = devices.find((d) => d.index === 2)
  assert.equal(earpods?.name, '(null)')
  assert.match(earpods?.uid ?? '', /EarPods/)
})

test('matching a speaker by name must not land on the microphone of the same device', () => {
  // The bug this file exists for: "EarPods" hit index 3, the EarPods Microphone, which is an
  // input sitting in the output list. AudioQueueStart then fails and there is no sound.
  const all = parseOutputDevices(OUTPUTS)
  const outputs = all.filter((d) => !/microphone|\bmic\b/i.test(d.name))
  assert.equal(matchDevice(outputs, 'EarPods')?.index, 2, 'resolves via the UID, not the mic name')
  assert.equal(matchDevice(all, 'EarPods')?.index, 3, 'unfiltered, it picks the wrong one')
})

test('an exact name beats a substring', () => {
  const devices = parseInputDevices(INPUTS)
  assert.equal(matchDevice(devices, 'EarPods Microphone')?.index, 3)
  assert.equal(matchDevice(devices, 'nothing here'), null)
})
