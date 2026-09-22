import { keytermsFromEnv } from './toggles/state.ts'

// Env in one place. Only PORT and HOST are required to boot; everything else is read here but
// checked by the module that needs it, so the dashboard can come up before any credential exists.

export interface Config {
  port: number
  host: string
  publicUrl: string | undefined
  vonage: {
    applicationId: string | undefined
    privateKeyPath: string | undefined
    number: string | undefined
  }
  deepgram: {
    apiKey: string | undefined
    sttModel: string
    ttsVoice: string
  }
  llm: {
    provider: string
    apiKey: string | undefined
    model: string
  }
  demo: {
    keyterms: string[]
  }
  local: {
    micDevice: string
    speakerDevice: string
    muteWhileSpeaking: boolean
  }
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

function flag(name: string, fallback: boolean): boolean {
  const raw = optional(name)
  if (raw === undefined) return fallback
  return raw === '1' || raw.toLowerCase() === 'true'
}

function integer(name: string, fallback: number): number {
  const raw = optional(name)
  if (raw === undefined) return fallback
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`${name} must be a port number between 1 and 65535, got "${raw}"`)
  }
  return parsed
}

export function loadConfig(): Config {
  return {
    port: integer('PORT', 3000),
    host: optional('HOST') ?? '127.0.0.1',
    publicUrl: optional('PUBLIC_URL')?.replace(/\/+$/, ''),
    vonage: {
      applicationId: optional('VONAGE_APPLICATION_ID'),
      privateKeyPath: optional('VONAGE_PRIVATE_KEY_PATH'),
      number: optional('VONAGE_NUMBER'),
    },
    deepgram: {
      apiKey: optional('DEEPGRAM_API_KEY'),
      sttModel: optional('DEEPGRAM_STT_MODEL') ?? 'flux-general-en',
      ttsVoice: optional('DEEPGRAM_TTS_VOICE') ?? 'flux-haley-en',
    },
    llm: {
      provider: optional('LLM_PROVIDER') ?? 'anthropic',
      apiKey: optional('LLM_API_KEY') ?? optional('ANTHROPIC_API_KEY'),
      model: optional('LLM_MODEL') ?? 'claude-opus-5',
    },
    demo: {
      keyterms: keytermsFromEnv(optional('DEMO_KEYTERMS')),
    },
    local: {
      // "none:default", ":N", or a name like "EarPods" resolved at startup.
      micDevice: optional('LOCAL_MIC_DEVICE') ?? 'none:default',
      // A CoreAudio index, or a name like "EarPods" resolved at startup by src/audio/devices.ts.
      // -1 is the system default. Names are safer: indices renumber when you plug things in.
      speakerDevice: optional('LOCAL_SPEAKER_DEVICE') ?? '-1',
      muteWhileSpeaking: flag('LOCAL_MUTE_WHILE_SPEAKING', false),
    },
  }
}
