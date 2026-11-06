import { SearchPanel } from '../shared/SearchPanel'
import '../shared/SearchPanel.css'

import './Popup.css'

export const Popup = () => {
  return (
    <main className="popup">
      <SearchPanel layout="popup" onAfterSearch={() => window.close()} />
    </main>
  )
}

export default Popup
