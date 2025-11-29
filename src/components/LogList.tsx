interface LogMessage {
  id: number
  message: string
  author: string
  version: string
  createdAt: string
}

interface LogListProps {
  logs: LogMessage[]
  loading: boolean
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export default function LogList({ logs, loading }: LogListProps) {
  if (loading) {
    return <div className="loading">Laddar...</div>
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <p>Inga inlägg ännu</p>
      </div>
    )
  }

  return (
    <div>
      <div className="log-list-header">Senaste inlägg</div>
      <div className="log-list">
        {logs.map(log => (
          <article key={log.id} className="log-item">
            <div className="log-meta">
              <span className="log-author">{log.author}</span>
              <span className="log-date">{formatDate(log.createdAt)}</span>
            </div>
            <p className="log-message">{log.message}</p>
            <div className="log-version">v{log.version}</div>
          </article>
        ))}
      </div>
    </div>
  )
}
