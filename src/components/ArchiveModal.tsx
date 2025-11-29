import type { LogMessage } from '../App'

interface ArchiveModalProps {
  logs: LogMessage[]
  onClose: () => void
  onUnarchive: (logId: number) => void
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

export default function ArchiveModal({ logs, onClose, onUnarchive }: ArchiveModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="archive-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Arkiv</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="archive-content">
          {logs.length === 0 ? (
            <div className="archive-empty">Inga arkiverade inlägg</div>
          ) : (
            <div className="archive-list">
              {logs.map(log => (
                <div key={log.id} className="archive-item">
                  <div className="archive-item-header">
                    <div className="archive-item-info">
                      {log.title && <strong className="archive-title">{log.title}</strong>}
                      <span className="archive-meta">
                        {log.author} · {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <button 
                      className="unarchive-btn"
                      onClick={() => onUnarchive(log.id)}
                    >
                      Återställ
                    </button>
                  </div>
                  <div 
                    className="archive-message"
                    dangerouslySetInnerHTML={{ __html: log.message }}
                  />
                  {log.archivedAt && (
                    <div className="archive-date">
                      Arkiverad {formatDate(log.archivedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

