// Env in one place. Only PORT and HOST are required to boot; everything else is read lazily by
// the module that needs it, so the dashboard can come up before any credential exists.

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
    ttsVoice: string | undefined
  }
  llm: {
    provider: string | undefined
    apiKey: string | undefined
    model: string | undefined
  }
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
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
    publicUrl: optional('PUBLIC_URL'),
    vonage: {
      applicationId: optional('VONAGE_APPLICATION_ID'),
      privateKeyPath: optional('VONAGE_PRIVATE_KEY_PATH'),
      number: optional('VONAGE_NUMBER'),
    },
    deepgram: {
      apiKey: optional('DEEPGRAM_API_KEY'),
      sttModel: optional('DEEPGRAM_STT_MODEL') ?? 'flux-general-en',
      ttsVoice: optional('DEEPGRAM_TTS_VOICE'),
    },
    llm: {
      provider: optional('LLM_PROVIDER'),
      apiKey: optional('LLM_API_KEY'),
      model: optional('LLM_MODEL'),
    },
  }
}
