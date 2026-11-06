# AGENTS.md — Multi Search

Guidance for AI agents and humans working on this Chrome extension.

## What this is

Manifest V3 Chrome extension (Vite + React + TypeScript via `@crxjs/vite-plugin`).  
Users type one query and open it across multiple search engines (Google, Bing, DuckDuckGo, …) to compare results.

## Layout

| Path              | Role                                        |
| ----------------- | ------------------------------------------- |
| `src/manifest.ts` | MV3 manifest (source of truth)              |
| `src/popup/`      | Toolbar popup                               |
| `src/newtab/`     | Chrome new-tab override (search hub)        |
| `src/options/`    | Enable / reorder / add custom engines       |
| `src/background/` | Service worker (optional message fallback)  |
| `src/shared/`     | Engines, storage, `SearchPanel`, tab opener |
| `build/`          | Load-unpacked output (gitignored)           |

Unused scaffold folders (`sidepanel`, `devtools`, `contentScript`) may still exist on disk but must **not** be registered in the manifest unless intentionally revived.

## Invariants

1. Search tabs are opened with `chrome.tabs.create` from the UI (`src/shared/openSearches.ts`). Do not rely only on messaging the service worker — popup close races break search.
2. Engine URL templates must include `{query}`; values are `encodeURIComponent`’d in `buildSearchUrl`.
3. Settings live in `chrome.storage.sync` under key `engines`. Prefer `getEngines` / `saveEngines` / `mergeWithDefaults`.
4. Built-in engines (`builtin: true`) can be disabled/edited but not deleted; customs can be deleted.
5. Permissions stay minimal (`storage`). Do not add host permissions or scraping for SERPs in v1.
6. Node/Bun for tooling; never assume Bun for the extension runtime (Chrome).

## Commands

```bash
bun install          # or npm install
bun run dev          # Vite + CRX watch → build/
bun run typecheck
bun run lint
bun run format
bun run build        # format + lint:fix + typecheck + tsc + vite build
bun run zip          # build + zip under package/
```

Load unpacked: `chrome://extensions` → Developer mode → **Load unpacked** → `build/`.  
After every meaningful change: rebuild (or keep `dev` running) and **Reload** the extension.

## Smoke test after changes

1. New tab shows Multi Search hub (not “file not found”).
2. Popup / new tab: query → **Search all selected** opens one tab per selected engine.
3. Per-engine **Open** opens a single tab.
4. Options: toggle, reorder, add custom `{query}` template, reset defaults.
5. Empty query shows validation and opens no tabs.

## Do / don’t

- **Do** keep popup and new tab sharing `SearchPanel`.
- **Do** keep engine list data-driven via `DEFAULT_ENGINES` + storage merge.
- **Don’t** scrape Google/Bing HTML or embed SERPs in iframes (blocked / fragile).
- **Don’t** commit secrets, `build/`, or `package/` archives.
- **Don’t** expand permissions without a clear product need.

## Suggested follow-ups

- Context-menu “Search selection with Multi Search”
- Omnibox keyword
- Remember last session checkbox set (optional)
