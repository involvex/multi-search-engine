import { useEffect, useState } from 'react'

import { SearchPanel } from '../shared/SearchPanel'
import '../shared/SearchPanel.css'

import './NewTab.css'

function formatClock(date: Date) {
  return {
    time: new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date),
    date: new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(date),
  }
}

export const NewTab = () => {
  const [clock, setClock] = useState(() => formatClock(new Date()))

  useEffect(() => {
    const tick = () => setClock(formatClock(new Date()))
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <main className="newtab">
      <div className="newtab__atmosphere" aria-hidden="true">
        <span className="newtab__orb newtab__orb--a" />
        <span className="newtab__orb newtab__orb--b" />
        <span className="newtab__grain" />
      </div>

      <div className="newtab__stage">
        <header className="newtab__hero">
          <p className="newtab__clock" aria-live="polite">
            <span className="newtab__time">{clock.time}</span>
            <span className="newtab__date">{clock.date}</span>
          </p>
          <div className="newtab__brand">
            <img
              className="newtab__mark"
              src="/img/logo-128.png"
              width={56}
              height={56}
              alt=""
              decoding="async"
            />
            <div className="newtab__brand-text">
              <h1 className="newtab__title">Multi Search</h1>
              <p className="newtab__tagline">One query. Every engine you trust.</p>
            </div>
          </div>
        </header>

        <SearchPanel layout="page" />
      </div>
    </main>
  )
}

export default NewTab
