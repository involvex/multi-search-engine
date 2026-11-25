import { FormEvent, useEffect, useMemo, useState } from 'react'

import { buildSearchUrl, type SearchEngine } from './engines'
import { openSearchTabs } from './openSearches'
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

  useEffect(() => {
    void (async () => {
      const list = await getEngines()
      const enabled = list.filter((engine) => engine.enabled)
      const selected = await getSelectedEngineIds(list)
      setEngines(enabled)
      setSelectedIds(new Set(selected))
      setLoading(false)
    })()
  }, [])

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

  const openUrls = async (urls: string[]) => {
    const opened = await openSearchTabs(urls)
    if (opened === 0) {
      setError('Could not open search tabs.')
      return
    }
    onAfterSearch?.()
  }

  const searchSelected = async () => {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a search query.')
      return
    }
    if (selectedEngines.length === 0) {
      setError('Select at least one engine.')
      return
    }

    setError('')
    const urls = selectedEngines.map((engine) => buildSearchUrl(engine, trimmed))
    await openUrls(urls)
  }

  const searchOne = async (engine: SearchEngine) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a search query.')
      return
    }

    setError('')
    await openUrls([buildSearchUrl(engine, trimmed)])
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

  return (
    <div className={`search-panel search-panel--${layout}`}>
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

      <form className="search-panel__form" onSubmit={onSubmit}>
        <label className="search-panel__label" htmlFor="multi-search-query">
          Search query
        </label>
        <input
          id="multi-search-query"
          className="search-panel__input"
          type="search"
          autoFocus
          placeholder="Search the web…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            if (error) {
              setError('')
            }
          }}
        />

        {error ? <p className="search-panel__error">{error}</p> : null}

        <button className="search-panel__primary" type="submit" disabled={loading}>
          {primaryLabel}
        </button>
      </form>

      <section className="search-panel__section" aria-label="Engines">
        <div className="search-panel__section-head">
          <h2>Engines</h2>
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
    </div>
  )
}
