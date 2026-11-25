const LLM_SETTINGS_KEY = 'llmProvider'

export type LlmSettings = {
  enabled: boolean
  baseUrl: string
  model: string
  apiKey: string
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  enabled: false,
  baseUrl: 'https://api.kilo.ai/api/gateway',
  model: 'kilo-auto/free',
  apiKey: '',
}

const LEGACY_KILO_BASE_URLS = new Set([
  'https://ai-gateway.kilo.ai/api/v1',
  'https://ai-gateway.kilo.ai/api/v1/',
])

function isLlmSettings(value: unknown): value is LlmSettings {
  if (!value || typeof value !== 'object') {
    return false
  }
  const settings = value as Partial<LlmSettings>
  return (
    typeof settings.enabled === 'boolean' &&
    typeof settings.baseUrl === 'string' &&
    typeof settings.model === 'string' &&
    typeof settings.apiKey === 'string'
  )
}

export async function getLlmSettings(): Promise<LlmSettings> {
  const result = await chrome.storage.local.get(LLM_SETTINGS_KEY)
  const stored = result[LLM_SETTINGS_KEY]
  if (!isLlmSettings(stored)) {
    return { ...DEFAULT_LLM_SETTINGS }
  }
  const baseUrl = stored.baseUrl.trim()
  return {
    enabled: stored.enabled,
    baseUrl:
      !baseUrl || LEGACY_KILO_BASE_URLS.has(baseUrl) ? DEFAULT_LLM_SETTINGS.baseUrl : baseUrl,
    model: stored.model.trim() || DEFAULT_LLM_SETTINGS.model,
    apiKey: stored.apiKey,
  }
}

export async function saveLlmSettings(settings: LlmSettings): Promise<void> {
  const next: LlmSettings = {
    enabled: settings.enabled,
    baseUrl: settings.baseUrl.trim() || DEFAULT_LLM_SETTINGS.baseUrl,
    model: settings.model.trim() || DEFAULT_LLM_SETTINGS.model,
    apiKey: settings.apiKey,
  }
  await chrome.storage.local.set({ [LLM_SETTINGS_KEY]: next })
}

export function llmSettingsReady(settings: LlmSettings): boolean {
  return settings.enabled && settings.baseUrl.trim().length > 0 && settings.apiKey.trim().length > 0
}

/** Origin pattern for chrome.permissions.request from a base URL. */
export function originPatternFromBaseUrl(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
      return null
    }
    return `${url.protocol}//${url.host}/*`
  } catch {
    return null
  }
}

export async function ensureHostPermissionForBaseUrl(baseUrl: string): Promise<boolean> {
  const origin = originPatternFromBaseUrl(baseUrl)
  if (!origin) {
    return false
  }

  const already = await chrome.permissions.contains({ origins: [origin] })
  if (already) {
    return true
  }

  return chrome.permissions.request({ origins: [origin] })
}
