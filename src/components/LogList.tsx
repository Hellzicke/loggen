import { useState } from 'react'
import type { LogMessage, ReadSignature } from '../App'

interface LogListProps {
  logs: LogMessage[]
  loading: boolean
  onSign: (logId: number, signature: ReadSignature) => void
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

interface SignFormProps {
  logId: number
  onSign: (logId: number, signature: ReadSignature) => void
  onCancel: () => void
}

function SignForm({ logId, onSign, onCancel }: SignFormProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return
    
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/logs/${logId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })

      if (res.ok) {
        const signature = await res.json()
        onSign(logId, signature)
        onCancel()
      } else if (res.status === 409) {
        setError('Du har redan signerat')
      } else {
        setError('Kunde inte signera')
      }
    } catch {
      setError('Något gick fel')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sign-form">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Ditt namn"
        className="sign-input"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />
      <div className="sign-actions">
        <button 
          className="sign-submit" 
          onClick={handleSubmit}
          disabled={submitting || !name.trim()}
        >
          {submitting ? '...' : 'Signera'}
        </button>
        <button className="sign-cancel" onClick={onCancel}>
          Avbryt
        </button>
      </div>
      {error && <div className="sign-error">{error}</div>}
    </div>
  )
}

export default function LogList({ logs, loading, onSign }: LogListProps) {
  const [signingId, setSigningId] = useState<number | null>(null)

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
          
          <div className="log-signatures">
            {log.signatures.length > 0 && (
              <div className="signatures-list">
                <span className="signatures-label">Läst av:</span>
                {log.signatures.map((sig, i) => (
                  <span key={sig.id} className="signature-name">
                    {sig.name}{i < log.signatures.length - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            )}
            
            {signingId === log.id ? (
              <SignForm 
                logId={log.id} 
                onSign={onSign}
                onCancel={() => setSigningId(null)}
              />
            ) : (
              <button 
                className="sign-btn"
                onClick={() => setSigningId(log.id)}
              >
                Signera som läst
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
