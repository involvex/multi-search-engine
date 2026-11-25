export type SearchEngine = {
  id: string
  name: string
  urlTemplate: string
  enabled: boolean
  /** Built-in engines cannot be deleted from Options. */
  builtin: boolean
}

export type SearchMode = 'classic' | 'ai'

export const AI_ENGINE_IDS = new Set(['google-ai', 'bing-copilot'])

const GOOGLE_AI_TEMPLATE = 'https://www.google.com/search?udm=50&q={query}'
const BING_COPILOT_TEMPLATE = 'https://www.bing.com/copilotsearch?q={query}&FORM=CSSCOP'

export const DEFAULT_ENGINES: SearchEngine[] = [
  {
    id: 'google',
    name: 'Google',
    urlTemplate: 'https://www.google.com/search?q={query}',
    enabled: true,
    builtin: true,
  },
  {
    id: 'bing',
    name: 'Bing',
    urlTemplate: 'https://www.bing.com/search?q={query}',
    enabled: true,
    builtin: true,
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    urlTemplate: 'https://duckduckgo.com/?q={query}',
    enabled: true,
    builtin: true,
  },
  {
    id: 'brave',
    name: 'Brave Search',
    urlTemplate: 'https://search.brave.com/search?q={query}',
    enabled: true,
    builtin: true,
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    urlTemplate: 'https://www.ecosia.org/search?q={query}',
    enabled: false,
    builtin: true,
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    urlTemplate: 'https://search.yahoo.com/search?p={query}',
    enabled: false,
    builtin: true,
  },
  {
    id: 'google-ai',
    name: 'Google AI Mode',
    urlTemplate: GOOGLE_AI_TEMPLATE,
    enabled: false,
    builtin: true,
  },
  {
    id: 'bing-copilot',
    name: 'Bing Copilot Search',
    urlTemplate: BING_COPILOT_TEMPLATE,
    enabled: false,
    builtin: true,
  },
]

export function isAiEngine(engine: SearchEngine | string): boolean {
  const id = typeof engine === 'string' ? engine : engine.id
  return AI_ENGINE_IDS.has(id)
}

export function buildSearchUrl(engine: SearchEngine, query: string): string {
  const trimmed = query.trim()
  if (!trimmed) {
    return ''
  }

  return engine.urlTemplate.replaceAll('{query}', encodeURIComponent(trimmed))
}

/** Build a search URL, remapping classic Google/Bing to AI targets when mode is `ai`. */
export function resolveSearchUrl(
  engine: SearchEngine,
  query: string,
  mode: SearchMode = 'classic',
): string {
  const trimmed = query.trim()
  if (!trimmed) {
    return ''
  }

  if (mode === 'ai') {
    if (engine.id === 'google') {
      return GOOGLE_AI_TEMPLATE.replaceAll('{query}', encodeURIComponent(trimmed))
    }
    if (engine.id === 'bing') {
      return BING_COPILOT_TEMPLATE.replaceAll('{query}', encodeURIComponent(trimmed))
    }
  }

  return buildSearchUrl(engine, trimmed)
}

export function isValidUrlTemplate(template: string): boolean {
  return template.includes('{query}') && /^https?:\/\//i.test(template)
}

export function createCustomEngineId(): string {
  return `custom-${crypto.randomUUID()}`
}

export function isSearchMode(value: unknown): value is SearchMode {
  return value === 'classic' || value === 'ai'
}
