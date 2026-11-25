# CHANGELOG

```txt
Summary
  1. document grouping follow 'SemVer2.0' protocol
  2. use 'PATCH' as a minimum granularity
  3. use concise descriptions
  4. type: feat \ fix \ update \ perf \ remove \ docs \ chore
  5. version timestamp follow the yyyy.MM.dd format
```

## 0.3.0 [2026.11.25]

- feat: Classic / AI search mode (Google/Bing remap to AI Mode / Copilot Search)
- feat: built-in Google AI Mode and Bing Copilot Search engines
- feat: optional OpenAI-compatible BYO provider (e.g. Kilo Gateway) for new-tab answers
- chore: optional host permissions requested only for the configured provider origin

## 0.2.0 [2026.11.25]

- feat: redesigned new-tab hub with clock, brand hero, and atmospheric backdrop
- feat: page layout engine tiles, recent local searches, and larger search field
- chore: Edge publish script accepts Partner Center `ProductID` env alias

## 0.1.0 [2026.11.25]

- feat: remember last engine checkbox set across popup / new tab / context menu
- feat: context menu “Search selection with Multi Search”
- feat: Select all / Select none and counted primary search button
- fix: store-facing description no longer names other browsers (Edge package validation)
- docs: Edge Add-ons first-listing copy, privacy notes, screenshot checklist
- chore: Edge Add-ons v1.1 dry-run upload script (`bun run edge:upload`)
- remove: empty `web_accessible_resources` and remote font URL from logo.svg

## 0.0.0 [2026.11.06]

- feat: initial
- feat: generator by ![create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext)
