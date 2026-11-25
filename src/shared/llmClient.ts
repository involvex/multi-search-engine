import type { LlmSettings } from './llmSettings'

const SYSTEM_PROMPT =
  'You are a helpful web-search assistant. Answer the user query clearly and concisely. ' +
  'When you are unsure, say so. Prefer short paragraphs and bullet lists. ' +
  'Mention well-known sources by name when relevant; do not invent URLs.'

export type LlmStreamHandlers = {
  onToken: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '')
  if (trimmed.endsWith('/chat/completions')) {
    return trimmed
  }
  return `${trimmed}/chat/completions`
}

async function readNonStreamResponse(
  response: Response,
  handlers: LlmStreamHandlers,
): Promise<void> {
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>
    error?: { message?: string }
  }
  if (data.error?.message) {
    handlers.onError(data.error.message)
    return
  }
  const content = data.choices?.[0]?.message?.content ?? ''
  if (content) {
    handlers.onToken(content)
  }
  handlers.onDone()
}

async function readSseStream(
  response: Response,
  handlers: LlmStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  if (!response.body) {
    throw new Error('Empty response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    if (signal.aborted) {
      await reader.cancel().catch(() => undefined)
      return
    }

    const { done, value } = await reader.read()
    if (done) {
      break
    }

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) {
        continue
      }
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') {
        continue
      }
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string | null } }>
        }
        const token = parsed.choices?.[0]?.delta?.content
        if (token) {
          handlers.onToken(token)
        }
      } catch {
        // Ignore malformed SSE chunks
      }
    }
  }

  handlers.onDone()
}

export async function streamChatCompletion(
  settings: LlmSettings,
  query: string,
  handlers: LlmStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const endpoint = chatCompletionsUrl(settings.baseUrl)
  const body = {
    model: settings.model,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query },
    ],
  }

  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      return
    }
    handlers.onError(error instanceof Error ? error.message : 'Network request failed.')
    return
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    handlers.onError(text || `Provider returned HTTP ${response.status}`)
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  try {
    if (
      contentType.includes('text/event-stream') ||
      contentType.includes('application/octet-stream')
    ) {
      await readSseStream(response, handlers, signal)
      return
    }

    // Some gateways ignore stream:true and return JSON.
    await readNonStreamResponse(response, handlers)
  } catch (error) {
    if (signal.aborted) {
      return
    }
    handlers.onError(error instanceof Error ? error.message : 'Failed to read provider response.')
  }
}

/** One-shot non-streaming call for Options “Test connection”. */
export async function testChatCompletion(settings: LlmSettings): Promise<string> {
  const endpoint = chatCompletionsUrl(settings.baseUrl)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      max_tokens: 32,
      messages: [
        { role: 'system', content: 'Reply with the single word OK.' },
        { role: 'user', content: 'ping' },
      ],
    }),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`)
  }

  try {
    const data = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    return data.choices?.[0]?.message?.content?.trim() || 'Connected.'
  } catch {
    return 'Connected.'
  }
}
