import { DEFAULT_ENGINES, isSearchMode, type SearchEngine, type SearchMode } from './engines'

const STORAGE_KEY = 'engines'
const SELECTED_IDS_KEY = 'selectedEngineIds'
const SEARCH_MODE_KEY = 'searchMode'

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

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
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

/**
 * Resolve which engine ids should be checked in the UI / context menu.
 * Missing key → all enabled engines. Saved array → intersect with still-enabled engines.
 */
export function resolveSelectedIds(
  engines: SearchEngine[],
  stored: string[] | undefined,
): string[] {
  const enabledIds = engines.filter((engine) => engine.enabled).map((engine) => engine.id)
  const enabledSet = new Set(enabledIds)

  if (!stored) {
    return enabledIds
  }

  return stored.filter((id) => enabledSet.has(id))
}

export async function getSelectedEngineIds(engines?: SearchEngine[]): Promise<string[]> {
  const list = engines ?? (await getEngines())
  const result = await chrome.storage.sync.get(SELECTED_IDS_KEY)
  const stored = result[SELECTED_IDS_KEY]
  const saved = isStringArray(stored) ? stored : undefined
  return resolveSelectedIds(list, saved)
}

export async function saveSelectedEngineIds(ids: string[]): Promise<void> {
  await chrome.storage.sync.set({ [SELECTED_IDS_KEY]: ids })
}

/** Keep selected ids in sync when Options enables, disables, deletes, or resets engines. */
export async function syncSelectedWithEngines(engines: SearchEngine[]): Promise<string[]> {
  const result = await chrome.storage.sync.get(SELECTED_IDS_KEY)
  const stored = result[SELECTED_IDS_KEY]
  const hadStored = isStringArray(stored)
  const previous = hadStored ? stored : undefined
  const enabledIds = engines.filter((engine) => engine.enabled).map((engine) => engine.id)
  const enabledSet = new Set(enabledIds)

  let next: string[]
  if (!previous) {
    next = enabledIds
  } else {
    const kept = previous.filter((id) => enabledSet.has(id))
    const newlyEnabled = enabledIds.filter((id) => !previous.includes(id) && !kept.includes(id))
    // Newly enabled engines (including freshly added customs) join the selection.
    // Disabled / deleted engines are already dropped by the filter above.
    next = [...kept, ...newlyEnabled]
  }

  await saveSelectedEngineIds(next)
  return next
}

export async function resetEngines(): Promise<SearchEngine[]> {
  const engines = DEFAULT_ENGINES.map((engine) => ({ ...engine }))
  await saveEngines(engines)
  await saveSelectedEngineIds(engines.filter((engine) => engine.enabled).map((engine) => engine.id))
  return engines
}

export async function getSearchMode(): Promise<SearchMode> {
  const result = await chrome.storage.sync.get(SEARCH_MODE_KEY)
  const stored = result[SEARCH_MODE_KEY]
  return isSearchMode(stored) ? stored : 'classic'
}

export async function saveSearchMode(mode: SearchMode): Promise<void> {
  await chrome.storage.sync.set({ [SEARCH_MODE_KEY]: mode })
}
