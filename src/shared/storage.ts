import { DEFAULT_ENGINES, type SearchEngine } from './engines'

const STORAGE_KEY = 'engines'

function isSearchEngine(value: unknown): value is SearchEngine {
  if (!value || typeof value !== 'object') {
    return false
  }

  const engine = value as Partial<SearchEngine>
  return (
    typeof engine.id === 'string' &&
    typeof engine.name === 'string' &&
    typeof engine.urlTemplate === 'string' &&
    typeof engine.enabled === 'boolean' &&
    typeof engine.builtin === 'boolean'
  )
}

/** Merge stored engines with defaults so new built-ins appear without wiping customs. */
export function mergeWithDefaults(stored: SearchEngine[]): SearchEngine[] {
  const byId = new Map(stored.filter(isSearchEngine).map((engine) => [engine.id, engine]))
  const mergedBuiltins = DEFAULT_ENGINES.map((defaults) => {
    const existing = byId.get(defaults.id)
    if (!existing) {
      return defaults
    }

    return {
      ...defaults,
      enabled: existing.enabled,
      name: existing.name || defaults.name,
      urlTemplate: existing.urlTemplate || defaults.urlTemplate,
      builtin: true,
    }
  })

  const custom = stored.filter(
    (engine) =>
      isSearchEngine(engine) && !engine.builtin && !DEFAULT_ENGINES.some((d) => d.id === engine.id),
  )

  const builtinIds = new Set(DEFAULT_ENGINES.map((engine) => engine.id))
  const orderedFromStorage = stored
    .filter(isSearchEngine)
    .map((engine) => {
      if (builtinIds.has(engine.id)) {
        return mergedBuiltins.find((item) => item.id === engine.id) ?? null
      }
      return custom.find((item) => item.id === engine.id) ?? null
    })
    .filter((engine): engine is SearchEngine => engine !== null)

  const seen = new Set(orderedFromStorage.map((engine) => engine.id))
  const missingBuiltins = mergedBuiltins.filter((engine) => !seen.has(engine.id))

  return [...orderedFromStorage, ...missingBuiltins]
}

export async function getEngines(): Promise<SearchEngine[]> {
  const result = await chrome.storage.sync.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY]

  if (!Array.isArray(stored) || stored.length === 0) {
    return DEFAULT_ENGINES.map((engine) => ({ ...engine }))
  }

  return mergeWithDefaults(stored as SearchEngine[])
}

export async function saveEngines(engines: SearchEngine[]): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: engines })
}

export async function resetEngines(): Promise<SearchEngine[]> {
  const engines = DEFAULT_ENGINES.map((engine) => ({ ...engine }))
  await saveEngines(engines)
  return engines
}
