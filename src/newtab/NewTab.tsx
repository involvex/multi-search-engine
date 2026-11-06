import { SearchPanel } from '../shared/SearchPanel'
import '../shared/SearchPanel.css'

import './NewTab.css'

export const NewTab = () => {
  return (
    <main className="newtab">
      <div className="newtab__glow" aria-hidden="true" />
      <SearchPanel layout="page" />
      <p className="newtab__hint">Compare results across engines, then pick the best one.</p>
    </main>
  )
}

export default NewTab
