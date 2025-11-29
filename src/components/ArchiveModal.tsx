import { useState, useMemo } from 'react'
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

function getMonthKey(dateString: string): string {
  const date = new Date(dateString)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
}

interface MonthGroup {
  key: string
  label: string
  count: number
}

export default function ArchiveModal({ logs, onClose, onUnarchive }: ArchiveModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const monthGroups = useMemo(() => {
    const groups: Record<string, number> = {}
    
    for (const log of logs) {
      const key = getMonthKey(log.createdAt)
      groups[key] = (groups[key] || 0) + 1
    }
    
    return Object.entries(groups)
      .map(([key, count]) => ({
        key,
        label: formatMonthLabel(key),
        count
      }))
      .sort((a, b) => b.key.localeCompare(a.key))
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (!selectedMonth) return logs
    return logs.filter(log => getMonthKey(log.createdAt) === selectedMonth)
  }, [logs, selectedMonth])

  const sortedLogs = useMemo(() => {
    return [...filteredLogs].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [filteredLogs])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="archive-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Arkiv</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        
        {logs.length === 0 ? (
          <div className="archive-content">
            <div className="archive-empty">Inga arkiverade inlägg</div>
          </div>
        ) : (
          <>
            <div className="archive-filters">
              <button
                className={`month-filter ${selectedMonth === null ? 'month-filter--active' : ''}`}
                onClick={() => setSelectedMonth(null)}
              >
                Alla ({logs.length})
              </button>
              {monthGroups.map(group => (
                <button
                  key={group.key}
                  className={`month-filter ${selectedMonth === group.key ? 'month-filter--active' : ''}`}
                  onClick={() => setSelectedMonth(group.key)}
                >
                  {group.label} ({group.count})
                </button>
              ))}
            </div>
            
            <div className="archive-content">
              <div className="archive-list">
                {sortedLogs.map(log => (
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
            </div>
          </>
        )}
      </div>
    </div>
  )
}
