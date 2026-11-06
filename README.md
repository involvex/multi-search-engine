# Multi Search

Chrome extension (Manifest V3) that opens your query across multiple search engines so you can compare results and pick the best one.

Built with Vite + React (`create-chrome-ext`).

## Features

- Popup search box with **Search all selected** and per-engine **Open**
- New Tab page replaced with the same Multi Search hub
- Options page to enable, reorder, edit, and add custom engines (`{query}` URL templates)
- Defaults: Google, Bing, DuckDuckGo, Brave Search, Ecosia, Yahoo
- Settings sync via `chrome.storage.sync`

## Requirements

- Node.js >= 14 (Bun works for scripts in this repo)
- Chrome / Chromium with Developer mode

## Setup

```shell
cd multi-search-engine
npm install
# or: bun install
```

## Develop

```shell
npm run dev
# or: bun run dev
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `build/` folder
4. Click the extension icon, type a query, search

Reload the extension after rebuilds.

### Smoke test

1. Open a new tab → Multi Search hub loads (not a missing-file error)
2. Popup or new tab: enter a query → **Search all selected** → tabs open for selected engines
3. Use **Open** on one engine → only that tab opens
4. Options: disable an engine, reorder, add a custom URL with `{query}`, search again
5. Empty query shows validation and opens no tabs

See also [AGENTS.md](./AGENTS.md) for contributor / AI-agent notes.

## Build / pack

```shell
npm run build
# or: bun run build

npm run zip
```

The `build/` folder is the unpacked extension. `zip` produces a store-ready archive under `package/`.

## Publish

See the [Chrome Web Store publish guide](https://developer.chrome.com/docs/webstore/publish).
