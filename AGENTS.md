# AGENTS.md — Multi Search

Guidance for AI agents and humans working on this Chrome extension.

## What this is

Manifest V3 Chrome extension (Vite + React + TypeScript via `@crxjs/vite-plugin`).
Users type one query and open it across multiple search engines (Google, Bing, DuckDuckGo, …) to compare results.

## Layout

| Path              | Role                                             |
| ----------------- | ------------------------------------------------ |
| `src/manifest.ts` | MV3 manifest (source of truth)                   |
| `src/popup/`      | Toolbar popup                                    |
| `src/newtab/`     | Chrome new-tab override (search hub)             |
| `src/options/`    | Enable / reorder / add custom engines            |
| `src/background/` | Service worker (context menu + message fallback) |
| `src/shared/`     | Engines, storage, `SearchPanel`, tab opener      |
| `scripts/`        | Edge Add-ons update helper (v1.1 API)            |
| `build/`          | Load-unpacked output (gitignored)                |

Unused scaffold folders (`sidepanel`, `devtools`, `contentScript`) may still exist on disk but must **not** be registered in the manifest unless intentionally revived.

## Invariants

1. Search tabs from the popup / new tab are opened with `chrome.tabs.create` via `src/shared/openSearches.ts`. Do not rely only on messaging the service worker for those UI paths — popup close races break search. The selection **context menu** is the exception: it must open tabs from the service worker.
2. Engine URL templates must include `{query}`; values are `encodeURIComponent`’d in `buildSearchUrl`.
3. Settings live in `chrome.storage.sync` under keys `engines` and `selectedEngineIds`. Prefer `getEngines` / `saveEngines` / `mergeWithDefaults` / `getSelectedEngineIds` / `saveSelectedEngineIds` / `syncSelectedWithEngines`.
4. Built-in engines (`builtin: true`) can be disabled/edited but not deleted; customs can be deleted.
5. Permissions stay minimal (`storage`, `contextMenus`). Optional host permissions are only for a user-configured OpenAI-compatible provider origin — never always-on broad hosts, and never scrape SERPs.
6. Node/Bun for tooling; never assume Bun for the extension runtime (Chrome / Edge).
7. BYO API keys live in `chrome.storage.local` only (`llmSettings.ts`). Classic/AI `searchMode` is sync; use `resolveSearchUrl` so Google/Bing remap in AI mode.

## Commands

```bash
bun install          # or npm install
bun run dev          # Vite + CRX watch → build/
bun run typecheck
bun run lint
bun run format
bun run build        # format + lint:fix + typecheck + tsc + vite build
bun run zip          # build + zip under package/
bun run edge:upload  # dry-run Edge Add-ons package upload (needs .env + product id)
bun run release      # patch bump (default): changelog, zip, commit, tag, push, GitHub release
# bun run release -- --minor|--major|--version x.y.z|--dry-run|--notes "…"
```

Load unpacked: `chrome://extensions` or `edge://extensions` → Developer mode → **Load unpacked** → `build/`.
After every meaningful change: rebuild (or keep `dev` running) and **Reload** the extension.

## Smoke test after changes

1. New tab shows Multi Search hub (not “file not found”).
2. Popup / new tab: query → primary search button opens one tab per selected engine.
3. Per-engine **Open** opens a single tab.
4. Options: toggle, reorder, add custom `{query}` template, reset defaults.
5. Empty query shows validation and opens no tabs.
6. Uncheck some engines, close popup, reopen → same checkboxes remain.
7. Select text on a page → context menu **Search “…” with Multi Search** opens tabs for the remembered selection.

## Do / don’t

- **Do** keep popup and new tab sharing `SearchPanel`.
- **Do** keep engine list data-driven via `DEFAULT_ENGINES` + storage merge.
- **Don’t** scrape Google/Bing HTML or embed SERPs in iframes (blocked / fragile).
- **Don’t** commit secrets, `build/`, or `package/` archives.
- **Don’t** expand permissions without a clear product need.
- **Don’t** use `msstore` for Edge add-ons — that CLI is for Microsoft Store apps. Use Partner Center for the first listing and `scripts/publish-edge.mjs` for later package updates.

## Suggested follow-ups

- Omnibox keyword
- Optional Chrome Web Store publish path

## Current work

- Tag → Edge Add-ons publish workflow (`.github/workflows/edge-publish.yml`); next `bun run release` exercises it

## Learned preferences

- Edge listing copy must not name other browsers (Partner Center validation)
- Prefer local `EDGE_PRODUCT_ID` / Partner Center `ProductID` for API updates after first listing
- Edge Add-ons listing: https://microsoftedge.microsoft.com/addons/detail/multi-search/camkpjdkmcfncdiohngnljdpjblpddmi
- Edge CI secrets: `MICROSOFT_CLIENT_ID`, `MICROSOFT_API_KEY`, `EDGE_PRODUCT_ID` (from local `.env` via `gh secret set`)

## Learned workspace facts

- `msstore` CLI is for Store apps, not Edge extensions; use `scripts/publish-edge.mjs`
- New tab and popup share `SearchPanel`; page layout gets recent queries via `chrome.storage.local`
- Google AI Mode URL uses `udm=50`; Bing Copilot Search uses `/copilotsearch`
- Kilo Gateway default base URL: `https://api.kilo.ai/api/gateway`
- `v*` tags trigger Edge upload+publish in GitHub Actions (zip built in CI)
