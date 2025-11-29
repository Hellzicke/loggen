import type { LogMessage } from '../App'

interface UnpinModalProps {
  log: LogMessage
  onArchive: () => void
  onKeep: () => void
  onCancel: () => void
}

export default function UnpinModal({ log, onArchive, onKeep, onCancel }: UnpinModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="unpin-modal" onClick={e => e.stopPropagation()}>
        <h3>Avnåla gammalt inlägg</h3>
        <p>
          Detta inlägg är äldre än 30 dagar. Vill du arkivera det direkt eller 
          behålla det i loggen i 30 dagar till?
        </p>
        <div className="unpin-preview">
          {log.title && <strong>{log.title}</strong>}
          <span className="unpin-author">av {log.author}</span>
        </div>
        <div className="unpin-actions">
          <button className="unpin-btn unpin-btn--archive" onClick={onArchive}>
            Arkivera nu
          </button>
          <button className="unpin-btn unpin-btn--keep" onClick={onKeep}>
            Behåll 30 dagar
          </button>
          <button className="unpin-btn unpin-btn--cancel" onClick={onCancel}>
            Avbryt
          </button>
        </div>
      </div>
    </div>
  )
}

