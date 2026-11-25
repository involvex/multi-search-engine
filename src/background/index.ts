import { buildSearchUrl } from '../shared/engines'
import { isOpenSearchesMessage } from '../shared/messages'
import { openSearchTabs } from '../shared/openSearches'
import { getEngines, getSelectedEngineIds } from '../shared/storage'

const CONTEXT_MENU_ID = 'multi-search-selection'

function ensureContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Search “%s” with Multi Search',
      contexts: ['selection'],
    })
  })
}

chrome.runtime.onInstalled.addListener(() => {
  ensureContextMenu()
})

chrome.runtime.onStartup.addListener(() => {
  ensureContextMenu()
})

ensureContextMenu()

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) {
    return
  }

  const query = typeof info.selectionText === 'string' ? info.selectionText.trim() : ''
  if (!query) {
    return
  }

  void (async () => {
    const engines = await getEngines()
    const selectedIds = await getSelectedEngineIds(engines)
    const idSet = new Set(selectedIds)
    const targets = engines.filter((engine) => engine.enabled && idSet.has(engine.id))
    const urls = targets
      .map((engine) => buildSearchUrl(engine, query))
      .filter((url) => url.length > 0)

    if (urls.length === 0) {
      return
    }

    await openSearchTabs(urls)
  })()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOpenSearchesMessage(message)) {
    return
  }

  void openSearchTabs(message.urls).then((opened) => {
    sendResponse({ ok: true, opened })
  })

  return true
})
