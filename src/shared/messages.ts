export const OPEN_SEARCHES = 'OPEN_SEARCHES' as const

export type OpenSearchesMessage = {
  type: typeof OPEN_SEARCHES
  urls: string[]
}

export type ExtensionMessage = OpenSearchesMessage

export function isOpenSearchesMessage(message: unknown): message is OpenSearchesMessage {
  if (!message || typeof message !== 'object') {
    return false
  }

  const candidate = message as Partial<OpenSearchesMessage>
  return candidate.type === OPEN_SEARCHES && Array.isArray(candidate.urls)
}
