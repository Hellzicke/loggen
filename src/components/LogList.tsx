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
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just nu'
  if (diffMins < 60) return `${diffMins} min`
  if (diffHours < 24) return `${diffHours} tim`
  if (diffDays < 7) return `${diffDays} d`
  
  return date.toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'short'
  })
}

function getInitials(name: string): string {
  return name.charAt(0).toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  ]
  const index = name.charCodeAt(0) % colors.length
  return colors[index]
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
    <div className="log-list">
      {logs.map(log => (
        <article key={log.id} className="log-item">
          <div className="log-header">
            <div 
              className="log-avatar" 
              style={{ background: getAvatarColor(log.author) }}
            >
              {getInitials(log.author)}
            </div>
            <div className="log-info">
              <span className="log-author">{log.author}</span>
              <span className="log-date">{formatDate(log.createdAt)}</span>
            </div>
          </div>
          <p className="log-message">{log.message}</p>
        </article>
      ))}
    </div>
  )
}
