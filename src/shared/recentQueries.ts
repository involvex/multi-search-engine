const RECENT_KEY = 'recentQueries'
const MAX_RECENT = 6

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

export async function getRecentQueries(): Promise<string[]> {
  const result = await chrome.storage.local.get(RECENT_KEY)
  const stored = result[RECENT_KEY]
  if (!isStringArray(stored)) {
    return []
  }
  return stored.slice(0, MAX_RECENT)
}

export async function rememberQuery(query: string): Promise<string[]> {
  const trimmed = query.trim()
  if (!trimmed) {
    return getRecentQueries()
  }

  const previous = await getRecentQueries()
  const next = [
    trimmed,
    ...previous.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
  ].slice(0, MAX_RECENT)
  await chrome.storage.local.set({ [RECENT_KEY]: next })
  return next
}

export async function clearRecentQueries(): Promise<void> {
  await chrome.storage.local.remove(RECENT_KEY)
}
