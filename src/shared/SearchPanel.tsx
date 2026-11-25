import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { AnswerPanel } from './AnswerPanel'
import { isAiEngine, resolveSearchUrl, type SearchEngine, type SearchMode } from './engines'
import { streamChatCompletion } from './llmClient'
import { getLlmSettings, llmSettingsReady, type LlmSettings } from './llmSettings'
import { openSearchTabs } from './openSearches'
import { getRecentQueries, rememberQuery } from './recentQueries'
import {
  getEngines,
  getSearchMode,
  getSelectedEngineIds,
  saveSearchMode,
  saveSelectedEngineIds,
} from './storage'

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
  const [searchMode, setSearchMode] = useState<SearchMode>('classic')
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null)
  const [answerQuery, setAnswerQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [answerLoading, setAnswerLoading] = useState(false)
  const [answerError, setAnswerError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    void (async () => {
      const list = await getEngines()
      const enabled = list.filter((engine) => engine.enabled)
      const selected = await getSelectedEngineIds(list)
      const mode = await getSearchMode()
      setEngines(enabled)
      setSelectedIds(new Set(selected))
      setSearchMode(mode)
      if (layout === 'page') {
        setRecent(await getRecentQueries())
        setLlmSettings(await getLlmSettings())
      }
      setLoading(false)
    })()
  }, [layout])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const selectedEngines = useMemo(
    () => engines.filter((engine) => selectedIds.has(engine.id)),
    [engines, selectedIds],
  )

  const persistSelection = (next: Set<string>) => {
    setSelectedIds(next)
    void saveSelectedEngineIds([...next])
  }

  const persistMode = (mode: SearchMode) => {
    setSearchMode(mode)
    void saveSearchMode(mode)
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

  const startLlmAnswer = (trimmed: string) => {
    if (layout !== 'page' || !llmSettings || !llmSettingsReady(llmSettings)) {
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setAnswerQuery(trimmed)
    setAnswer('')
    setAnswerError('')
    setAnswerLoading(true)

    void streamChatCompletion(
      llmSettings,
      trimmed,
      {
        onToken: (text) => {
          setAnswer((prev) => prev + text)
        },
        onDone: () => {
          setAnswerLoading(false)
        },
        onError: (message) => {
          setAnswerError(message)
          setAnswerLoading(false)
        },
      },
      controller.signal,
    )
  }

  const openUrls = async (urls: string[], rememberedQuery?: string) => {
    const opened = await openSearchTabs(urls)
    if (opened === 0) {
      setError('Could not open search tabs.')
      return false
    }
    if (rememberedQuery && layout === 'page') {
      setRecent(await rememberQuery(rememberedQuery))
    }
    onAfterSearch?.()
    return true
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
    const urls = selectedEngines.map((engine) => resolveSearchUrl(engine, trimmed, searchMode))
    const opened = await openUrls(urls, trimmed)
    if (opened) {
      startLlmAnswer(trimmed)
    }
  }

  const searchOne = async (engine: SearchEngine) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setError('Enter a search query.')
      return
    }

    setError('')
    const opened = await openUrls([resolveSearchUrl(engine, trimmed, searchMode)], trimmed)
    if (opened) {
      startLlmAnswer(trimmed)
    }
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
  const byoReady = Boolean(llmSettings && llmSettingsReady(llmSettings))

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

      <div className="search-panel__mode" role="group" aria-label="Search mode">
        <button
          type="button"
          className={`search-panel__mode-btn${searchMode === 'classic' ? ' search-panel__mode-btn--on' : ''}`}
          aria-pressed={searchMode === 'classic'}
          onClick={() => persistMode('classic')}
        >
          Classic
        </button>
        <button
          type="button"
          className={`search-panel__mode-btn${searchMode === 'ai' ? ' search-panel__mode-btn--on' : ''}`}
          aria-pressed={searchMode === 'ai'}
          onClick={() => persistMode('ai')}
        >
          AI
        </button>
      </div>
      {searchMode === 'ai' ? (
        <p className="search-panel__mode-note">
          Google and Bing open their AI search pages. Dedicated AI engines always use AI URLs.
        </p>
      ) : null}

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

      {isPage ? (
        <AnswerPanel
          query={answerQuery}
          answer={answer}
          loading={answerLoading}
          error={answerError}
        />
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
              const ai = isAiEngine(engine)
              return (
                <li key={engine.id}>
                  <button
                    type="button"
                    className={`search-panel__tile${checked ? ' search-panel__tile--on' : ''}`}
                    aria-pressed={checked}
                    onClick={() => toggleEngine(engine.id)}
                  >
                    <span className="search-panel__tile-name">
                      {engine.name}
                      {ai ? <span className="search-panel__ai-badge">AI</span> : null}
                    </span>
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
                  <span>
                    {engine.name}
                    {isAiEngine(engine) ? <span className="search-panel__ai-badge">AI</span> : null}
                  </span>
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
          Press Enter to open one tab per selected engine.
          {byoReady
            ? ' Your OpenAI-compatible provider will also answer below.'
            : ' Enable a BYO AI provider in Options for an inline answer.'}{' '}
          Choices sync with the toolbar popup.
        </p>
      ) : null}
    </div>
  )
}
