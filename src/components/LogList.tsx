import { useState } from 'react'
import type { LogMessage, ReadSignature, Comment } from '../App'

interface LogListProps {
  logs: LogMessage[]
  loading: boolean
  onSign: (logId: number, signature: ReadSignature) => void
  onPin: (logId: number) => void
  onComment: (logId: number, comment: Comment, parentId?: number) => void
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

interface CommentFormProps {
  logId: number
  parentId?: number
  onComment: (logId: number, comment: Comment, parentId?: number) => void
  onCancel: () => void
  placeholder?: string
}

function CommentForm({ logId, parentId, onComment, onCancel, placeholder }: CommentFormProps) {
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!author.trim() || !message.trim()) return
    
    setSubmitting(true)

    try {
      const res = await fetch(`/api/logs/${logId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          author: author.trim(), 
          message: message.trim(),
          parentId 
        })
      })

      if (res.ok) {
        const comment = await res.json()
        onComment(logId, comment, parentId)
        onCancel()
      }
    } catch (error) {
      console.error('Failed to post comment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="comment-form">
      <input
        type="text"
        value={author}
        onChange={e => setAuthor(e.target.value)}
        placeholder="Ditt namn"
        className="comment-input"
      />
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={placeholder || 'Skriv en kommentar...'}
        className="comment-textarea"
        rows={2}
      />
      <div className="comment-actions">
        <button 
          className="comment-submit" 
          onClick={handleSubmit}
          disabled={submitting || !author.trim() || !message.trim()}
        >
          {submitting ? '...' : 'Skicka'}
        </button>
        <button className="comment-cancel" onClick={onCancel}>
          Avbryt
        </button>
      </div>
    </div>
  )
}

interface CommentItemProps {
  comment: Comment
  logId: number
  onComment: (logId: number, comment: Comment, parentId?: number) => void
}

function CommentItem({ comment, logId, onComment }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  return (
    <div className="comment-item">
      <div className="comment-header">
        <div 
          className="comment-avatar"
          style={{ background: getAvatarColor(comment.author) }}
        >
          {getInitials(comment.author)}
        </div>
        <div className="comment-meta">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-date">{formatDate(comment.createdAt)}</span>
        </div>
      </div>
      <p className="comment-message">{comment.message}</p>
      
      {!showReplyForm && (
        <button className="reply-btn" onClick={() => setShowReplyForm(true)}>
          Svara
        </button>
      )}
      
      {showReplyForm && (
        <CommentForm
          logId={logId}
          parentId={comment.id}
          onComment={onComment}
          onCancel={() => setShowReplyForm(false)}
          placeholder="Skriv ett svar..."
        />
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <div key={reply.id} className="reply-item">
              <div className="comment-header">
                <div 
                  className="comment-avatar comment-avatar--small"
                  style={{ background: getAvatarColor(reply.author) }}
                >
                  {getInitials(reply.author)}
                </div>
                <div className="comment-meta">
                  <span className="comment-author">{reply.author}</span>
                  <span className="comment-date">{formatDate(reply.createdAt)}</span>
                </div>
              </div>
              <p className="comment-message">{reply.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LogList({ logs, loading, onSign, onPin, onComment }: LogListProps) {
  const [signingId, setSigningId] = useState<number | null>(null)
  const [commentingId, setCommentingId] = useState<number | null>(null)

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
        <article key={log.id} className={`log-item ${log.pinned ? 'log-item--pinned' : ''}`}>
          <div className="log-header">
            <div 
              className="log-avatar" 
              style={{ background: getAvatarColor(log.author) }}
            >
              {getInitials(log.author)}
            </div>
            <div className="log-info">
              <span className="log-author">
                {log.author}
                {log.pinned && <span className="pinned-badge">Nålad</span>}
              </span>
              <span className="log-date">{formatDate(log.createdAt)}</span>
            </div>
            <button 
              className={`pin-btn ${log.pinned ? 'pin-btn--active' : ''}`}
              onClick={() => onPin(log.id)}
              title={log.pinned ? 'Ta bort nål' : 'Nåla inlägg'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={log.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                <path d="M15 4.5l-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4M9 15l-4.5 4.5M14.5 4L20 9.5" />
              </svg>
            </button>
          </div>
          <p className="log-message">{log.message}</p>
          
          {/* Comments section */}
          {log.comments && log.comments.length > 0 && (
            <div className="comments-section">
              {log.comments.map(comment => (
                <CommentItem 
                  key={comment.id} 
                  comment={comment} 
                  logId={log.id}
                  onComment={onComment}
                />
              ))}
            </div>
          )}

          {commentingId === log.id ? (
            <div className="add-comment">
              <CommentForm
                logId={log.id}
                onComment={onComment}
                onCancel={() => setCommentingId(null)}
                placeholder="Ställ en fråga..."
              />
            </div>
          ) : (
            <button 
              className="comment-btn"
              onClick={() => setCommentingId(log.id)}
            >
              Ställ en fråga
            </button>
          )}
          
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
