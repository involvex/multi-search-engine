import { FormEvent, useEffect, useMemo, useState } from 'react'

import { buildSearchUrl, type SearchEngine } from './engines'
import { openSearchTabs } from './openSearches'
import { getRecentQueries, rememberQuery } from './recentQueries'
import { getEngines, getSelectedEngineIds, saveSelectedEngineIds } from './storage'

type SearchPanelProps = {
  layout?: 'popup' | 'page'
  onAfterSearch?: () => void
}

export const SearchPanel = ({ layout = 'popup', onAfterSearch }: SearchPanelProps) => {
  const [engines, setEngines] = useState<SearchEngine[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    void (async () => {
      const list = await getEngines()
      const enabled = list.filter((engine) => engine.enabled)
      const selected = await getSelectedEngineIds(list)
      setEngines(enabled)
      setSelectedIds(new Set(selected))
      if (layout === 'page') {
        setRecent(await getRecentQueries())
      }
      setLoading(false)
    })()
  }, [layout])

  const selectedEngines = useMemo(
    () => engines.filter((engine) => selectedIds.has(engine.id)),
    [engines, selectedIds],
  )

  const persistSelection = (next: Set<string>) => {
    setSelectedIds(next)
    void saveSelectedEngineIds([...next])
  }

  const toggleEngine = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    persistSelection(next)
  }

  const selectAll = () => {
    persistSelection(new Set(engines.map((engine) => engine.id)))
  }

  const selectNone = () => {
    persistSelection(new Set())
  }

  const openUrls = async (urls: string[], rememberedQuery?: string) => {
    const opened = await openSearchTabs(urls)
    if (opened === 0) {
      setError('Could not open search tabs.')
      return
    }
    if (rememberedQuery && layout === 'page') {
      setRecent(await rememberQuery(rememberedQuery))
    }
    onAfterSearch?.()
  }

  const searchSelected = async (overrideQuery?: string) => {
    const trimmed = (overrideQuery ?? query).trim()
    if (!trimmed) {
      setError('Enter a search query.')
      return
    }
    if (selectedEngines.length === 0) {
      setError('Select at least one engine.')
      return
    }

    setError('')
    if (overrideQuery) {
      setQuery(trimmed)
    }
    const urls = selectedEngines.map((engine) => buildSearchUrl(engine, trimmed))
    await openUrls(urls, trimmed)
  }

  const searchOne = async (engine: SearchEngine) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a search query.')
      return
    }

    setError('')
    await openUrls([buildSearchUrl(engine, trimmed)], trimmed)
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void searchSelected()
  }

  const selectedCount = selectedEngines.length
  const primaryLabel =
    selectedCount === 0
      ? 'Search all selected'
      : selectedCount === 1
        ? 'Search 1 engine'
        : `Search ${selectedCount} engines`

  const isPage = layout === 'page'

  return (
    <div className={`search-panel search-panel--${layout}`}>
      {!isPage ? (
        <header className="search-panel__header">
          <h1>Multi Search</h1>
          <button
            type="button"
            className="search-panel__link"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Options
          </button>
        </header>
      ) : (
        <div className="search-panel__page-tools">
          <button
            type="button"
            className="search-panel__link"
            onClick={() => void chrome.runtime.openOptionsPage()}
          >
            Manage engines
          </button>
        </div>
      )}

      <form className="search-panel__form" onSubmit={onSubmit}>
        <label className="search-panel__label" htmlFor="multi-search-query">
          Search query
        </label>
        <div className="search-panel__query-row">
          <input
            id="multi-search-query"
            className="search-panel__input"
            type="search"
            autoFocus
            placeholder={isPage ? 'Search across your engines…' : 'Search the web…'}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              if (error) {
                setError('')
              }
            }}
          />
          <button className="search-panel__primary" type="submit" disabled={loading}>
            {primaryLabel}
          </button>
        </div>

        {error ? <p className="search-panel__error">{error}</p> : null}
      </form>

      {isPage && recent.length > 0 ? (
        <section className="search-panel__recent" aria-label="Recent searches">
          <div className="search-panel__section-head">
            <h2>Recent</h2>
          </div>
          <ul className="search-panel__recent-list">
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  className="search-panel__recent-chip"
                  onClick={() => void searchSelected(item)}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="search-panel__section" aria-label="Engines">
        <div className="search-panel__section-head">
          <h2>{isPage ? 'Engines for this search' : 'Engines'}</h2>
          {!loading && engines.length > 0 ? (
            <div className="search-panel__bulk">
              <button type="button" className="search-panel__link" onClick={selectAll}>
                Select all
              </button>
              <button type="button" className="search-panel__link" onClick={selectNone}>
                Select none
              </button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <p className="search-panel__muted">Loading…</p>
        ) : engines.length === 0 ? (
          <p className="search-panel__muted">No engines enabled. Turn some on in Options.</p>
        ) : isPage ? (
          <ul className="search-panel__tiles">
            {engines.map((engine) => {
              const checked = selectedIds.has(engine.id)
              return (
                <li key={engine.id}>
                  <button
                    type="button"
                    className={`search-panel__tile${checked ? ' search-panel__tile--on' : ''}`}
                    aria-pressed={checked}
                    onClick={() => toggleEngine(engine.id)}
                  >
                    <span className="search-panel__tile-name">{engine.name}</span>
                    <span className="search-panel__tile-state">{checked ? 'On' : 'Off'}</span>
                  </button>
                  <button
                    type="button"
                    className="search-panel__engine-btn"
                    onClick={() => void searchOne(engine)}
                    title={`Search only ${engine.name}`}
                  >
                    Open
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="search-panel__engines">
            {engines.map((engine) => (
              <li key={engine.id}>
                <label className="search-panel__engine">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(engine.id)}
                    onChange={() => toggleEngine(engine.id)}
                  />
                  <span>{engine.name}</span>
                </label>
                <button
                  type="button"
                  className="search-panel__engine-btn"
                  onClick={() => void searchOne(engine)}
                  title={`Search only ${engine.name}`}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isPage ? (
        <p className="search-panel__hint">
          Press Enter to open one tab per selected engine. Choices sync with the toolbar popup.
        </p>
      ) : null}
    </div>
  )
}
