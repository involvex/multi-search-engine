import { FormEvent, useEffect, useState } from 'react'

import { createCustomEngineId, isValidUrlTemplate, type SearchEngine } from '../shared/engines'
import { getEngines, resetEngines, saveEngines, syncSelectedWithEngines } from '../shared/storage'

import './Options.css'

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

  useEffect(() => {
    void getEngines().then((list) => {
      setEngines(list)
      setLoading(false)
    })
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

  return (
    <main className="options">
      <header className="options__header">
        <div>
          <h1>Multi Search — Options</h1>
          <p className="options__help">
            Enable engines, reorder them, or add custom search URLs. Use <code>{'{query}'}</code>{' '}
            where the search terms go.
          </p>
        </div>
        <button type="button" className="options__secondary" onClick={() => void onReset()}>
          Reset defaults
        </button>
      </header>

      {error ? <p className="options__error">{error}</p> : null}
      {status ? <p className="options__status">{status}</p> : null}

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
    </main>
  )
}

export default Options
