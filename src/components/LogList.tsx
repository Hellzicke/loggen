import { useState, useRef, useEffect } from 'react'
import type { LogMessage, ReadSignature, Comment, Reaction } from '../App'

interface LogListProps {
  logs: LogMessage[]
  loading: boolean
  onSign: (logId: number, signature: ReadSignature) => void
  onPin: (logId: number) => void
  onComment: (logId: number, comment: Comment, parentId?: number) => void
  onEditLog: (logId: number, title: string, message: string) => void
  onDeleteComment: (logId: number, commentId: number, parentId?: number) => void
  onReaction: (logId: number, emoji: string) => void
  }

const EMOJI_OPTIONS = ['👍', '❤️', '😊', '🎉', '👀', '🙏']

interface ReactionGroup {
  emoji: string
  count: number
}

function groupReactions(reactions: Reaction[]): ReactionGroup[] {
  const groups: Record<string, ReactionGroup> = {}
  for (const r of reactions) {
    if (!groups[r.emoji]) {
      groups[r.emoji] = { emoji: r.emoji, count: 0 }
    }
    groups[r.emoji].count++
  }
  return Object.values(groups)
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

function hashName(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.toLowerCase().charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash)
}

function getAvatarColor(name: string): string {
  const colors = [
    'linear-gradient(135deg, #667eea, #764ba2)',
    'linear-gradient(135deg, #f093fb, #f5576c)',
    'linear-gradient(135deg, #4facfe, #00f2fe)',
    'linear-gradient(135deg, #43e97b, #38f9d7)',
    'linear-gradient(135deg, #fa709a, #fee140)',
    'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    'linear-gradient(135deg, #ff6b6b, #ee5a24)',
    'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    'linear-gradient(135deg, #00b894, #00cec9)',
    'linear-gradient(135deg, #fd79a8, #e84393)',
    'linear-gradient(135deg, #fdcb6e, #e17055)',
    'linear-gradient(135deg, #74b9ff, #0984e3)',
  ]
  const index = hashName(name) % colors.length
  return colors[index]
}

function countComments(comments: Comment[]): number {
  return comments.reduce((total, c) => {
    const replyCount = c.replies ? c.replies.length : 0
    return total + 1 + replyCount
  }, 0)
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
    <div className="sign-form-inline">
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Ditt namn"
        className="sign-input-inline"
        autoFocus
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
      />
      <button 
        className="sign-submit-inline" 
        onClick={handleSubmit}
        disabled={submitting || !name.trim()}
      >
        {submitting ? '...' : 'OK'}
      </button>
      <button className="sign-cancel-inline" onClick={onCancel}>
        &times;
      </button>
      {error && <div className="sign-error-inline">{error}</div>}
    </div>
  )
}

interface EditFormProps {
  initialTitle: string
  initialMessage: string
  onSave: (title: string, message: string) => void
  onCancel: () => void
}

function EditForm({ initialTitle, initialMessage, onSave, onCancel }: EditFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [message, setMessage] = useState(initialMessage)
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialMessage
    }
  }, [initialMessage])

  const execFormat = (command: string) => {
    document.execCommand(command, false)
    editorRef.current?.focus()
    if (editorRef.current) {
      setMessage(editorRef.current.innerHTML)
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      setMessage(editorRef.current.innerHTML)
    }
  }

  const plainText = message.replace(/<[^>]*>/g, '').trim()

  return (
    <div className="edit-form">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="edit-input"
        placeholder="Rubrik"
      />
      <div className="edit-editor-container">
        <div className="format-toolbar format-toolbar--small">
          <button type="button" className="format-btn format-btn--bold" onClick={() => execFormat('bold')}>B</button>
          <button type="button" className="format-btn format-btn--italic" onClick={() => execFormat('italic')}>I</button>
          <button type="button" className="format-btn format-btn--underline" onClick={() => execFormat('underline')}>U</button>
        </div>
        <div
          ref={editorRef}
          className="edit-editor"
          contentEditable
          onInput={handleInput}
          suppressContentEditableWarning
        />
      </div>
      <div className="edit-actions">
        <button 
          className="edit-save" 
          onClick={() => onSave(title, message)}
          disabled={!plainText}
        >
          Spara
        </button>
        <button className="edit-cancel" onClick={onCancel}>
          Avbryt
        </button>
      </div>
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
  onDelete: (logId: number, commentId: number, parentId?: number) => void
  parentId?: number
}

function CommentItem({ comment, logId, onComment, onDelete, parentId }: CommentItemProps) {
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
        <button 
          className="delete-btn"
          onClick={() => onDelete(logId, comment.id, parentId)}
          title="Ta bort"
        >
          &times;
        </button>
      </div>
      <div className="comment-message" dangerouslySetInnerHTML={{ __html: comment.message }} />
      
      <div className="comment-footer">
        {!showReplyForm && (
          <button className="reply-btn" onClick={() => setShowReplyForm(true)}>
            Svara
          </button>
        )}
      </div>
      
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
            <CommentItem 
              key={reply.id} 
              comment={reply}
              logId={logId}
              onComment={onComment}
              onDelete={onDelete}
              parentId={comment.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function LogList({ logs, loading, onSign, onPin, onComment, onEditLog, onDeleteComment, onReaction }: LogListProps) {
  const [signingId, setSigningId] = useState<number | null>(null)
  const [commentingId, setCommentingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null)
  const [reactionCooldown, setReactionCooldown] = useState<Set<number>>(new Set())

  const handleReactionWithCooldown = (logId: number, emoji: string) => {
    if (reactionCooldown.has(logId)) return
    
    onReaction(logId, emoji)
    setReactionCooldown(prev => new Set(prev).add(logId))
    
    // 2 second cooldown per post
    setTimeout(() => {
      setReactionCooldown(prev => {
        const next = new Set(prev)
        next.delete(logId)
        return next
      })
    }, 2000)
  }

  const toggleComments = (logId: number) => {
    setExpandedComments(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

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
      {logs.map(log => {
        const commentCount = countComments(log.comments || [])
        const isExpanded = expandedComments.has(log.id)

        return (
          <article key={log.id} className={`log-item ${log.pinned ? 'log-item--pinned' : ''}`}>
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
              <button 
                className="header-btn"
                onClick={() => setEditingId(editingId === log.id ? null : log.id)}
                title="Redigera"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button 
                className={`header-btn ${log.pinned ? 'header-btn--active' : ''}`}
                onClick={() => onPin(log.id)}
                title={log.pinned ? 'Ta bort nål' : 'Nåla inlägg'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={log.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M15 4.5l-4 4L7 10l-1.5 1.5 7 7L14 17l1.5-4 4-4M9 15l-4.5 4.5M14.5 4L20 9.5" />
                </svg>
              </button>
            </div>

            {editingId === log.id ? (
              <EditForm
                initialTitle={log.title}
                initialMessage={log.message}
                onSave={(title, message) => {
                  onEditLog(log.id, title, message)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div className="log-content">
                {log.title && (
                  <div className="log-title-row">
                    <h3 className="log-title">{log.title}</h3>
                    {log.pinned && <span className="pinned-badge">Nålad</span>}
                  </div>
                )}
                <div className="log-message" dangerouslySetInnerHTML={{ __html: log.message }} />
              </div>
            )}
            
            {/* Reactions */}
            {log.reactions && log.reactions.length > 0 && (
              <div className="reactions-display">
                {groupReactions(log.reactions).map(group => (
                  <button 
                    key={group.emoji} 
                    className={`reaction-badge ${reactionCooldown.has(log.id) ? 'reaction-badge--disabled' : ''}`}
                    onClick={() => handleReactionWithCooldown(log.id, group.emoji)}
                    disabled={reactionCooldown.has(log.id)}
                  >
                    {group.emoji} {group.count}
                  </button>
                ))}
              </div>
            )}

            {/* Divider and comments section */}
            <div className="log-divider"></div>
            
            <div className="log-interactions">
              <div className="reaction-trigger">
                <button 
                  className="interaction-btn"
                  onClick={() => setShowReactionPicker(showReactionPicker === log.id ? null : log.id)}
                >
                  Reagera
                </button>
                {showReactionPicker === log.id && (
                  <div className="reaction-picker">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        className={`emoji-btn ${reactionCooldown.has(log.id) ? 'emoji-btn--disabled' : ''}`}
                        onClick={() => {
                          if (!reactionCooldown.has(log.id)) {
                            handleReactionWithCooldown(log.id, emoji)
                            setShowReactionPicker(null)
                          }
                        }}
                        disabled={reactionCooldown.has(log.id)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button 
                className="interaction-btn"
                onClick={() => setCommentingId(commentingId === log.id ? null : log.id)}
              >
                Ställ en fråga
              </button>
              
              {commentCount > 0 && (
                <button 
                  className="interaction-btn"
                  onClick={() => toggleComments(log.id)}
                >
                  {isExpanded ? 'Dölj' : 'Visa'} {commentCount} {commentCount === 1 ? 'kommentar' : 'kommentarer'}
                </button>
              )}
            </div>

            {commentingId === log.id && (
              <div className="add-comment">
                <CommentForm
                  logId={log.id}
                  onComment={(logId, comment, parentId) => {
                    onComment(logId, comment, parentId)
                    setExpandedComments(prev => new Set(prev).add(logId))
                    setCommentingId(null)
                  }}
                  onCancel={() => setCommentingId(null)}
                  placeholder="Ställ en fråga..."
                />
              </div>
            )}

            {isExpanded && log.comments && log.comments.length > 0 && (
              <div className="comments-section">
                {log.comments.map(comment => (
                  <CommentItem 
                    key={comment.id} 
                    comment={comment} 
                    logId={log.id}
                    onComment={onComment}
                    onDelete={onDeleteComment}
                  />
                ))}
              </div>
            )}
            
            {/* Footer with signatures */}
            <div className="log-footer">
              <div className="signatures-left">
                {log.signatures.length > 0 && (
                  <div className="signatures-list">
                    <span className="signatures-label">Läst av:</span>
                    {log.signatures.length <= 3 ? (
                      log.signatures.map((sig, i) => (
                        <span key={sig.id} className="signature-name">
                          {sig.name}{i < log.signatures.length - 1 ? ', ' : ''}
                        </span>
                      ))
                    ) : (
                      <>
                        {log.signatures.slice(0, 3).map((sig, i) => (
                          <span key={sig.id} className="signature-name">
                            {sig.name}{i < 2 ? ', ' : ''}
                          </span>
                        ))}
                        <span className="signatures-more-wrapper">
                          <span className="signatures-more">
                            {' '}och {log.signatures.length - 3} till
                          </span>
                          <span className="signatures-tooltip">
                            {log.signatures.map(s => s.name).join(', ')}
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
              
              <div className="signatures-right">
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
            </div>
          </article>
        )
      })}
    </div>
  )
}
