import Anthropic from '@anthropic-ai/sdk'

// One LLM, one provider, no framework. The loop measures first-token time around this; this
// class only streams text. A refusal or an API error surfaces as a thrown error so the loop can
// speak a canned line instead of leaving silence on stage.

export interface LlmOptions {
  model: string
  system: string
  apiKey?: string
  maxTokens?: number
  timeoutMs?: number
}

export class LlmRefused extends Error {
  constructor() {
    super('the model declined to answer')
  }
}

export class Llm {
  private readonly client: Anthropic
  private readonly maxTokens: number
  private readonly timeoutMs: number

  private readonly opts: LlmOptions

  constructor(opts: LlmOptions) {
    this.opts = opts
    this.client = new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {})
    // Spoken replies are a paragraph at most; the prompt keeps them short, this is the ceiling.
    this.maxTokens = opts.maxTokens ?? 1024
    this.timeoutMs = opts.timeoutMs ?? 20_000
  }

  /** Streams text deltas. Throws on API failure; returns quietly when aborted. */
  async *stream(messages: Anthropic.MessageParam[], signal: AbortSignal): AsyncGenerator<string> {
    const stream = this.client.messages.stream(
      {
        model: this.opts.model,
        max_tokens: this.maxTokens,
        system: this.opts.system,
        messages,
        // Voice replies need speed more than depth. Effort is the lever for that.
        output_config: { effort: 'low' },
      },
      { signal, timeout: this.timeoutMs },
    )
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield event.delta.text
        }
      }
      const final = await stream.finalMessage()
      if (final.stop_reason === 'refusal') throw new LlmRefused()
    } catch (err) {
      if (err instanceof Anthropic.APIUserAbortError || signal.aborted) return
      throw err
    }
  }
}

export function describeLlmError(err: unknown): string {
  if (err instanceof LlmRefused) return err.message
  if (err instanceof Anthropic.AuthenticationError) return 'LLM authentication failed, check the API key'
  if (err instanceof Anthropic.RateLimitError) return 'LLM rate limited'
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'LLM timed out'
  if (err instanceof Anthropic.APIConnectionError) return 'LLM unreachable'
  if (err instanceof Anthropic.APIError) return `LLM error ${err.status}: ${err.message}`
  return err instanceof Error ? err.message : String(err)
}
