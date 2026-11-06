/** Open search URLs in new tabs. First tab is focused; the rest open in background. */
export async function openSearchTabs(urls: string[]): Promise<number> {
  const valid = urls.filter((url) => typeof url === 'string' && /^https?:\/\//i.test(url))

  for (const [index, url] of valid.entries()) {
    await chrome.tabs.create({ url, active: index === 0 })
  }

  return valid.length
}
