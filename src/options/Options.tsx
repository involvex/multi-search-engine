import { FormEvent, useEffect, useState } from 'react'

import packageData from '../../package.json'
import {
  createCustomEngineId,
  isAiEngine,
  isValidUrlTemplate,
  type SearchEngine,
} from '../shared/engines'
import { testChatCompletion } from '../shared/llmClient'
import {
  DEFAULT_LLM_SETTINGS,
  ensureHostPermissionForBaseUrl,
  getLlmSettings,
  originPatternFromBaseUrl,
  saveLlmSettings,
  type LlmSettings,
} from '../shared/llmSettings'
import { getEngines, resetEngines, saveEngines, syncSelectedWithEngines } from '../shared/storage'

import './Options.css'

const REPO_URL = 'https://github.com/involvex/multi-search-engine'
const SPONSOR_URL = 'https://github.com/involvex/multi-search-engine?sponsor=1'
const AUTHOR_URL = 'https://github.com/involvex'
const EDGE_ADDONS_URL =
  'https://microsoftedge.microsoft.com/addons/detail/multi-search/camkpjdkmcfncdiohngnljdpjblpddmi'

type Draft = {
  name: string
  urlTemplate: string
}

const emptyDraft = (): Draft => ({
  name: '',
  urlTemplate: 'https://example.com/search?q={query}',
})

export const Options = () => {
  const [engines, setEngines] = useState<SearchEngine[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [llm, setLlm] = useState<LlmSettings>({ ...DEFAULT_LLM_SETTINGS })
  const [llmBusy, setLlmBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      const [list, settings] = await Promise.all([getEngines(), getLlmSettings()])
      setEngines(list)
      setLlm(settings)
      setLoading(false)
    })()
  }, [])

  const persist = async (next: SearchEngine[], message = 'Saved.') => {
    setEngines(next)
    await saveEngines(next)
    await syncSelectedWithEngines(next)
    setStatus(message)
    setError('')
  }

  const toggleEnabled = (id: string) => {
    const next = engines.map((engine) =>
      engine.id === id ? { ...engine, enabled: !engine.enabled } : engine,
    )
    void persist(next)
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= engines.length) {
      return
    }

    const next = [...engines]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    void persist(next)
  }

  const startEdit = (engine: SearchEngine) => {
    setEditingId(engine.id)
    setEditDraft({ name: engine.name, urlTemplate: engine.urlTemplate })
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditDraft(emptyDraft())
  }

  const saveEdit = async () => {
    if (!editingId) {
      return
    }

    const name = editDraft.name.trim()
    const urlTemplate = editDraft.urlTemplate.trim()
    if (!name) {
      setError('Name is required.')
      return
    }
    if (!isValidUrlTemplate(urlTemplate)) {
      setError('URL template must start with http(s) and include {query}.')
      return
    }

    const next = engines.map((engine) =>
      engine.id === editingId ? { ...engine, name, urlTemplate } : engine,
    )
    await persist(next, 'Engine updated.')
    cancelEdit()
  }

  const removeEngine = (id: string) => {
    const engine = engines.find((item) => item.id === id)
    if (!engine || engine.builtin) {
      return
    }

    void persist(
      engines.filter((item) => item.id !== id),
      'Custom engine removed.',
    )
  }

  const addEngine = async (event: FormEvent) => {
    event.preventDefault()
    const name = draft.name.trim()
    const urlTemplate = draft.urlTemplate.trim()

    if (!name) {
      setError('Name is required.')
      return
    }
    if (!isValidUrlTemplate(urlTemplate)) {
      setError('URL template must start with http(s) and include {query}.')
      return
    }

    const engine: SearchEngine = {
      id: createCustomEngineId(),
      name,
      urlTemplate,
      enabled: true,
      builtin: false,
    }

    await persist([...engines, engine], 'Custom engine added.')
    setDraft(emptyDraft())
  }

  const onReset = async () => {
    const confirmed = window.confirm(
      'Reset all engines to defaults? Custom engines will be removed.',
    )
    if (!confirmed) {
      return
    }

    const next = await resetEngines()
    setEngines(next)
    cancelEdit()
    setStatus('Reset to defaults.')
    setError('')
  }

  const saveLlm = async () => {
    setLlmBusy(true)
    setError('')
    try {
      const baseUrl = llm.baseUrl.trim() || DEFAULT_LLM_SETTINGS.baseUrl
      if (llm.enabled) {
        if (!llm.apiKey.trim()) {
          setError('API key is required when the AI provider is enabled.')
          return
        }
        if (!originPatternFromBaseUrl(baseUrl)) {
          setError('Base URL must be https://… or http://localhost…')
          return
        }
        const granted = await ensureHostPermissionForBaseUrl(baseUrl)
        if (!granted) {
          setError('Host permission was not granted for that base URL.')
          return
        }
      }

      const next = { ...llm, baseUrl }
      await saveLlmSettings(next)
      setLlm(next)
      setStatus('AI provider settings saved on this device.')
    } finally {
      setLlmBusy(false)
    }
  }

  const testLlm = async () => {
    setLlmBusy(true)
    setError('')
    try {
      const baseUrl = llm.baseUrl.trim() || DEFAULT_LLM_SETTINGS.baseUrl
      if (!llm.apiKey.trim()) {
        setError('Enter an API key before testing.')
        return
      }
      if (!originPatternFromBaseUrl(baseUrl)) {
        setError('Base URL must be https://… or http://localhost…')
        return
      }
      const granted = await ensureHostPermissionForBaseUrl(baseUrl)
      if (!granted) {
        setError('Host permission was not granted for that base URL.')
        return
      }
      const reply = await testChatCompletion({ ...llm, baseUrl })
      setStatus(`Connection OK: ${reply.slice(0, 80)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed.')
    } finally {
      setLlmBusy(false)
    }
  }

  return (
    <main className="options">
      <header className="options__header">
        <div>
          <h1>Multi Search — Options</h1>
          <p className="options__help">
            Enable engines, reorder them, or add custom search URLs. Use <code>{'{query}'}</code>{' '}
            where the search terms go. Optionally connect an OpenAI-compatible provider for inline
            answers on the new-tab hub.
          </p>
        </div>
        <button type="button" className="options__secondary" onClick={() => void onReset()}>
          Reset defaults
        </button>
      </header>

      {error ? <p className="options__error">{error}</p> : null}
      {status ? <p className="options__status">{status}</p> : null}

      <section className="options__section" aria-label="AI provider">
        <h2>AI provider (OpenAI-compatible)</h2>
        <p className="options__help">
          Your API key stays in local browser storage on this device and is only sent to the base
          URL you configure (for example Kilo Gateway). Saving or testing asks for optional host
          access to that origin only.
        </p>
        <div className="options__llm">
          <label className="options__toggle">
            <input
              type="checkbox"
              checked={llm.enabled}
              onChange={(event) => setLlm((prev) => ({ ...prev, enabled: event.target.checked }))}
            />
            <span>Enable inline AI answers on the new-tab hub</span>
          </label>
          <label>
            Base URL
            <input
              type="url"
              value={llm.baseUrl}
              placeholder={DEFAULT_LLM_SETTINGS.baseUrl}
              onChange={(event) => setLlm((prev) => ({ ...prev, baseUrl: event.target.value }))}
            />
          </label>
          <label>
            Model
            <input
              type="text"
              value={llm.model}
              placeholder={DEFAULT_LLM_SETTINGS.model}
              onChange={(event) => setLlm((prev) => ({ ...prev, model: event.target.value }))}
            />
          </label>
          <label>
            API key
            <input
              type="password"
              value={llm.apiKey}
              autoComplete="off"
              placeholder="Bearer token for your gateway"
              onChange={(event) => setLlm((prev) => ({ ...prev, apiKey: event.target.value }))}
            />
          </label>
          <div className="options__actions">
            <button type="button" disabled={llmBusy} onClick={() => void saveLlm()}>
              Save provider
            </button>
            <button
              type="button"
              className="options__secondary"
              disabled={llmBusy}
              onClick={() => void testLlm()}
            >
              Test connection
            </button>
          </div>
        </div>
      </section>

      <section className="options__section" aria-label="Engine list">
        <h2>Engines</h2>
        {loading ? (
          <p className="options__muted">Loading…</p>
        ) : (
          <ul className="options__list">
            {engines.map((engine, index) => (
              <li key={engine.id} className="options__item">
                {editingId === engine.id ? (
                  <div className="options__edit">
                    <input
                      type="text"
                      value={editDraft.name}
                      onChange={(event) =>
                        setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                      }
                      aria-label="Engine name"
                    />
                    <input
                      type="url"
                      value={editDraft.urlTemplate}
                      onChange={(event) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          urlTemplate: event.target.value,
                        }))
                      }
                      aria-label="URL template"
                    />
                    <div className="options__actions">
                      <button type="button" onClick={() => void saveEdit()}>
                        Save
                      </button>
                      <button type="button" className="options__secondary" onClick={cancelEdit}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="options__toggle">
                      <input
                        type="checkbox"
                        checked={engine.enabled}
                        onChange={() => toggleEnabled(engine.id)}
                      />
                      <span>
                        <strong>{engine.name}</strong>
                        {isAiEngine(engine) ? <span className="options__badge">AI</span> : null}
                        {!engine.builtin ? <span className="options__badge">custom</span> : null}
                      </span>
                    </label>
                    <code className="options__template">{engine.urlTemplate}</code>
                    <div className="options__actions">
                      <button
                        type="button"
                        className="options__secondary"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move ${engine.name} up`}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="options__secondary"
                        disabled={index === engines.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move ${engine.name} down`}
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        className="options__secondary"
                        onClick={() => startEdit(engine)}
                      >
                        Edit
                      </button>
                      {!engine.builtin ? (
                        <button
                          type="button"
                          className="options__danger"
                          onClick={() => removeEngine(engine.id)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="options__section" aria-label="Add custom engine">
        <h2>Add custom engine</h2>
        <form className="options__add" onSubmit={(event) => void addEngine(event)}>
          <label>
            Name
            <input
              type="text"
              value={draft.name}
              placeholder="My Search"
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </label>
          <label>
            URL template
            <input
              type="url"
              value={draft.urlTemplate}
              placeholder="https://example.com/search?q={query}"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, urlTemplate: event.target.value }))
              }
            />
          </label>
          <button type="submit">Add engine</button>
        </form>
      </section>

      <section className="options__section options__about" aria-label="About">
        <h2>About</h2>
        <dl className="options__about-list">
          <div>
            <dt>Extension</dt>
            <dd>
              {packageData.displayName || packageData.name} v{packageData.version}
            </dd>
          </div>
          <div>
            <dt>Author</dt>
            <dd>
              <a className="options__about-link" href={AUTHOR_URL} target="_blank" rel="noreferrer">
                {packageData.author}
              </a>
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              <a className="options__about-link" href={REPO_URL} target="_blank" rel="noreferrer">
                github.com/involvex/multi-search-engine
              </a>
            </dd>
          </div>
          <div>
            <dt>Edge store</dt>
            <dd>
              <a
                className="options__about-link"
                href={EDGE_ADDONS_URL}
                target="_blank"
                rel="noreferrer"
              >
                Microsoft Edge Add-ons
              </a>
            </dd>
          </div>
          <div>
            <dt>Support</dt>
            <dd>
              <a
                className="options__about-link options__about-link--sponsor"
                href={SPONSOR_URL}
                target="_blank"
                rel="noreferrer"
              >
                Sponsor on GitHub
              </a>
            </dd>
          </div>
        </dl>
        <p className="options__help">
          Multi Search is open source. Issues and pull requests are welcome on GitHub. If it saves
          you time, sponsoring helps keep development going.
        </p>
      </section>
    </main>
  )
}

export default Options
