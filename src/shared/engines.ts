export type SearchEngine = {
  id: string
  name: string
  urlTemplate: string
  enabled: boolean
  /** Built-in engines cannot be deleted from Options. */
  builtin: boolean
}

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
]

export function buildSearchUrl(engine: SearchEngine, query: string): string {
  const trimmed = query.trim()
  if (!trimmed) {
    return ''
  }

  return engine.urlTemplate.replaceAll('{query}', encodeURIComponent(trimmed))
}

export function isValidUrlTemplate(template: string): boolean {
  return template.includes('{query}') && /^https?:\/\//i.test(template)
}

export function createCustomEngineId(): string {
  return `custom-${crypto.randomUUID()}`
}
