# Multi Search

Chrome / Edge extension (Manifest V3) that opens your query across multiple search engines so you can compare results and pick the best one.

Built with Vite + React (`create-chrome-ext`).

## Features

- Popup search box with a counted primary action and per-engine **Open**
- Classic / AI search mode (AI remaps Google → AI Mode, Bing → Copilot Search)
- Built-in Google AI Mode and Bing Copilot Search engines (off by default)
- Optional OpenAI-compatible provider (e.g. Kilo Gateway) for inline answers on the new-tab hub
- Remembers which engines you last checked (`chrome.storage.sync`)
- New Tab page replaced with the same Multi Search hub
- Right-click selected text → **Search “…” with Multi Search**
- Options page to enable, reorder, edit, and add custom engines (`{query}` URL templates)
- Defaults: Google, Bing, DuckDuckGo, Brave Search, Ecosia, Yahoo (+ AI engines disabled)

## Requirements

- Node.js >= 14 (Bun works for scripts in this repo)
- Chrome / Chromium or Microsoft Edge with Developer mode

## Setup

```shell
cd multi-search-engine
npm install
# or: bun install
```

Copy [`.env.example`](./.env.example) to `.env` only if you plan to upload package updates to Edge Add-ons later.

## Develop

```shell
npm run dev
# or: bun run dev
```

Then in Chrome or Edge:

1. Open `chrome://extensions` or `edge://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `build/` folder
4. Click the extension icon, type a query, search

Reload the extension after rebuilds.

### Smoke test

1. Open a new tab → Multi Search hub loads (not a missing-file error)
2. Popup or new tab: enter a query → primary search button → tabs open for selected engines
3. Use **Open** on one engine → only that tab opens
4. Options: disable an engine, reorder, add a custom URL with `{query}`, search again
5. Empty query shows validation and opens no tabs
6. Uncheck engines, close popup, reopen → same checkboxes remain
7. Select text on a page → context menu opens tabs for the remembered selection
8. Toggle **AI** mode → Google/Bing open AI search URLs; enable Google AI Mode / Bing Copilot in Options if you want them as separate engines
9. Options → AI provider: save a base URL + key, grant host permission, then search from the new tab to see an inline answer

See also [AGENTS.md](./AGENTS.md) for contributor / AI-agent notes.

## Build / pack

```shell
npm run build
# or: bun run build

npm run zip
```

The `build/` folder is the unpacked extension. `zip` produces a store-ready archive under `package/`.

## Publish

### Chrome Web Store

See the [Chrome Web Store publish guide](https://developer.chrome.com/docs/webstore/publish).

### Microsoft Edge Add-ons (first listing)

`msstore` is for Microsoft Store apps (MSIX / MSI / EXE). Edge extensions use [Partner Center](https://partner.microsoft.com/dashboard) under the Microsoft Edge program. The [Update REST API](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/using-addons-api?tabs=v1-1) can only update a product that already exists.

1. Run `bun run zip` and upload `package/*.zip` via **Create new extension**.
2. Fill listing, privacy, and screenshots in Partner Center (paste text from below).
3. After the product exists, copy its Product ID into `.env` as `EDGE_PRODUCT_ID`.
4. Later package updates: `bun run edge:upload` (dry-run), then `bun run edge:upload -- --upload`.

#### Store listing (paste into Partner Center)

**Short description** (manifest / listing blurb — avoid naming other browsers such as DuckDuckGo):

> Open one query across several search engines at once, then pick the best result.

**Full description** (250+ characters; for Store listings — keep browser brand names out of marketing copy):

> Multi Search opens your query in several search engines at once so you can compare results side by side and choose the best answer. Use the toolbar popup, the Multi Search new-tab hub, or right-click selected text on any page. Enable, reorder, and edit built-in search engines, or add your own HTTPS search URL templates with a `{query}` placeholder. Your engine list and last checkbox selection sync through browser storage. The extension does not scrape results pages or collect your search terms; each search opens a normal tab to the engine you chose.

**Single purpose:**

> Help users compare web search results by opening one query across multiple search engines they select.

**Permission justifications:**

- `storage` — Saves the engine list (enabled/order/custom templates), Classic/AI mode, and the last set of engines you checked so the popup, new tab, and context menu stay consistent. Optional BYO API keys are stored in local storage on this device only.
- `contextMenus` — Adds a right-click item on selected text so you can search that selection with Multi Search without copying it into the popup.
- Optional host access — Requested only when you enable an OpenAI-compatible AI provider, and only for the origin of the base URL you enter (for example `https://api.kilo.ai/*`). Used to call that provider’s chat completions API from the new-tab hub.

**Remote code:** No. All extension code ships in the package; searches open ordinary HTTPS pages in new tabs. Optional BYO answers use `fetch` to the user-configured endpoint only.

**Data / privacy:** Queries are not collected by Multi Search. They are only placed into the selected engines’ URL templates and opened as tabs you control. If you enable a BYO AI provider, the query and your API key are sent only to that configured base URL. Engine preferences sync via the browser’s sync storage when signed in; API keys never sync.

**New tab override:** The extension replaces the browser new-tab page with the Multi Search hub (same search UI as the popup). This is the product’s search home, not an advertising page.

#### Screenshot checklist

Capture these from a loaded unpacked build before submitting:

1. Popup with a sample query and several engines checked
2. New tab hub centered on the search panel
3. Options page showing the engine list and a custom template

### Edge package update script

```shell
bun run edge:upload              # dry-run (default)
bun run edge:upload -- --upload  # upload zip to draft submission
bun run edge:upload -- --upload --publish  # upload then publish draft
```

Requires `.env` with `MICROSOFT_CLIENT_ID`, `MICROSOFT_API_KEY`, and `EDGE_PRODUCT_ID`. Never commit `.env`.

### GitHub release script

Bumps `package.json` (manifest version follows at build), prepends `CHANGELOG.md`, runs `zip`, commits, tags, pushes, and creates a GitHub release with the zip artifact. Default bump is **patch**. Requires a clean tree and authenticated `gh`.

```shell
bun run release                         # 0.3.0 → 0.3.1
bun run release -- --dry-run
bun run release -- --minor
bun run release -- --major
bun run release -- --version 1.0.0
bun run release -- --notes "feat: …" --notes "fix: …"
```
