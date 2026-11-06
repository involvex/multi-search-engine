import { isOpenSearchesMessage } from '../shared/messages'
import { openSearchTabs } from '../shared/openSearches'

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isOpenSearchesMessage(message)) {
    return
  }

  void openSearchTabs(message.urls).then((opened) => {
    sendResponse({ ok: true, opened })
  })

  return true
})
