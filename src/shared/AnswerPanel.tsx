type AnswerPanelProps = {
  query: string
  answer: string
  loading: boolean
  error: string
}

export const AnswerPanel = ({ query, answer, loading, error }: AnswerPanelProps) => {
  if (!loading && !answer && !error) {
    return null
  }

  return (
    <section className="answer-panel" aria-label="AI answer" aria-live="polite">
      <div className="search-panel__section-head">
        <h2>AI answer</h2>
        {loading ? <span className="answer-panel__status">Streaming…</span> : null}
      </div>
      {query ? <p className="answer-panel__query">For “{query}”</p> : null}
      {error ? <p className="search-panel__error">{error}</p> : null}
      {answer ? <div className="answer-panel__body">{answer}</div> : null}
      {!answer && loading ? (
        <p className="search-panel__muted">Waiting for the first tokens…</p>
      ) : null}
    </section>
  )
}
