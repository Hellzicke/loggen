import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from './ConfirmModal'

interface SuggestionVote {
  id: number
  name: string
  suggestionId: number
  createdAt: string
}

interface SuggestionComment {
  id: number
  message: string
  author: string
  suggestionId: number
  parentId: number | null
  createdAt: string
  replies: SuggestionComment[]
}

export interface Suggestion {
  id: number
  title: string
  description: string
  author: string
  category: string
  status: string
  decision: string | null
  decidedBy: string | null
  decidedAt: string | null
  lockedAt: string | null
  archived: boolean
  archivedAt: string | null
  createdAt: string
  votes: SuggestionVote[]
  comments: SuggestionComment[]
}

interface SuggestionBoxProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
}

const CATEGORIES = [
  { value: 'förbättring', label: 'Förbättring' },
  { value: 'inköp', label: 'Inköp' },
  { value: 'rutin', label: 'Ny rutin' },
  { value: 'aktivitet', label: 'Aktivitet' },
  { value: 'övrigt', label: 'Övrigt' },
]

const STATUS_LABELS: Record<string, string> = {
  open: 'Öppet',
  in_review: 'Under behandling',
  decided: 'Beslutat',
  locked: 'Låst',
}

const STATUS_COLORS: Record<string, string> = {
  open: '#42b883',
  in_review: '#f0a030',
  decided: '#1877f2',
  locked: '#8a8d91',
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
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })
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
  return colors[hashName(name) % colors.length]
}

function getCategoryLabel(value: string): string {
  return CATEGORIES.find(c => c.value === value)?.label || value
}

export default function SuggestionBox({ authenticatedFetch }: SuggestionBoxProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [archivedSuggestions, setArchivedSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [commentingId, setCommentingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [voteName, setVoteName] = useState(() => localStorage.getItem('suggestionVoteName') || '')

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/suggestions')
      const data = await res.json()
      if (Array.isArray(data)) setSuggestions(data)
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    } finally {
      setLoading(false)
    }
  }, [authenticatedFetch])

  const fetchArchivedSuggestions = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/suggestions/archived')
      const data = await res.json()
      if (Array.isArray(data)) setArchivedSuggestions(data)
    } catch (error) {
      console.error('Failed to fetch archived suggestions:', error)
    }
  }, [authenticatedFetch])

  useEffect(() => {
    fetchSuggestions()
  }, [fetchSuggestions])

  useEffect(() => {
    if (showArchived) fetchArchivedSuggestions()
  }, [showArchived, fetchArchivedSuggestions])

  const handleVote = async (suggestionId: number) => {
    if (!voteName.trim()) return

    const name = voteName.trim()
    localStorage.setItem('suggestionVoteName', name)

    const suggestion = suggestions.find(s => s.id === suggestionId)
    const hasVoted = suggestion?.votes.some(v => v.name === name)

    try {
      if (hasVoted) {
        await authenticatedFetch(`/api/suggestions/${suggestionId}/vote`, {
          method: 'DELETE',
          body: JSON.stringify({ name })
        })
        setSuggestions(prev => prev.map(s =>
          s.id === suggestionId
            ? { ...s, votes: s.votes.filter(v => v.name !== name) }
            : s
        ))
      } else {
        const res = await authenticatedFetch(`/api/suggestions/${suggestionId}/vote`, {
          method: 'POST',
          body: JSON.stringify({ name })
        })
        if (res.ok) {
          const vote = await res.json()
          setSuggestions(prev => prev.map(s =>
            s.id === suggestionId
              ? { ...s, votes: [...s.votes, vote] }
              : s
          ))
        }
      }
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  const handleComment = async (suggestionId: number, message: string, author: string, parentId?: number) => {
    try {
      const res = await authenticatedFetch(`/api/suggestions/${suggestionId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message, author, parentId })
      })
      if (res.ok) {
        const comment = await res.json()
        setSuggestions(prev => prev.map(s => {
          if (s.id !== suggestionId) return s
          if (parentId) {
            return {
              ...s,
              comments: s.comments.map(c =>
                c.id === parentId
                  ? { ...c, replies: [...c.replies, comment] }
                  : c
              )
            }
          }
          return { ...s, comments: [...s.comments, { ...comment, replies: [] }] }
        }))
        setExpandedComments(prev => new Set(prev).add(suggestionId))
      }
    } catch (error) {
      console.error('Failed to comment:', error)
    }
  }

  const handleDeleteComment = async (suggestionId: number, commentId: number, parentId?: number) => {
    try {
      const res = await authenticatedFetch(`/api/suggestions/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setSuggestions(prev => prev.map(s => {
          if (s.id !== suggestionId) return s
          if (parentId) {
            return {
              ...s,
              comments: s.comments.map(c =>
                c.id === parentId
                  ? { ...c, replies: c.replies.filter(r => r.id !== commentId) }
                  : c
              )
            }
          }
          return { ...s, comments: s.comments.filter(c => c.id !== commentId) }
        }))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const handleCreate = async (title: string, description: string, author: string, category: string) => {
    try {
      const res = await authenticatedFetch('/api/suggestions', {
        method: 'POST',
        body: JSON.stringify({ title, description, author, category })
      })
      if (res.ok) {
        const suggestion = await res.json()
        setSuggestions(prev => [suggestion, ...prev])
        setShowForm(false)
      }
    } catch (error) {
      console.error('Failed to create suggestion:', error)
    }
  }

  const sortedSuggestions = [...suggestions]
    .filter(s => filterCategory === 'all' || s.category === filterCategory)
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { open: 0, in_review: 1, decided: 2, locked: 3 }
      const orderDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0)
      if (orderDiff !== 0) return orderDiff
      return b.votes.length - a.votes.length
    })

  const countComments = (comments: SuggestionComment[]): number =>
    comments.reduce((total, c) => total + 1 + (c.replies?.length || 0), 0)

  if (loading) return <div className="loading">Laddar...</div>

  return (
    <div className="suggestion-box">
      <div className="suggestion-header-bar">
        <div className="suggestion-actions-left">
          <button className="suggestion-create-btn" onClick={() => setShowForm(true)}>
            + Nytt förslag
          </button>
          <select
            className="suggestion-filter"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">Alla kategorier</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="suggestion-actions-right">
          <div className="suggestion-vote-name">
            <label>Ditt namn för röstning:</label>
            <input
              type="text"
              value={voteName}
              onChange={e => {
                setVoteName(e.target.value)
                localStorage.setItem('suggestionVoteName', e.target.value)
              }}
              placeholder="Ditt namn"
              className="vote-name-input"
            />
          </div>
          <button
            className={`suggestion-archive-toggle ${showArchived ? 'active' : ''}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Visa aktiva' : 'Visa arkiv'}
          </button>
        </div>
      </div>

      {showForm && (
        <CreateSuggestionForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
        />
      )}

      {sortedSuggestions.length === 0 && !showArchived && (
        <div className="empty-state">
          <p>Inga förslag ännu. Var först med att lämna ett!</p>
        </div>
      )}

      {(showArchived ? archivedSuggestions : sortedSuggestions).map(suggestion => {
        const commentCount = countComments(suggestion.comments)
        const isExpanded = expandedComments.has(suggestion.id)
        const isLocked = !!suggestion.lockedAt
        const hasVoted = suggestion.votes.some(v => v.name === voteName.trim())

        return (
          <article key={suggestion.id} className={`suggestion-item suggestion-item--${suggestion.status}`}>
            <div className="suggestion-item-header">
              <div
                className="log-avatar"
                style={{ background: getAvatarColor(suggestion.author) }}
              >
                {getInitials(suggestion.author)}
              </div>
              <div className="suggestion-item-info">
                <span className="log-author">{suggestion.author}</span>
                <span className="log-date">{formatDate(suggestion.createdAt)}</span>
              </div>
              <span
                className="suggestion-status-badge"
                style={{ background: STATUS_COLORS[suggestion.status] || '#8a8d91' }}
              >
                {STATUS_LABELS[suggestion.status] || suggestion.status}
              </span>
              <span className="suggestion-category-badge">
                {getCategoryLabel(suggestion.category)}
              </span>
            </div>

            <div className="suggestion-item-content">
              <h3 className="suggestion-item-title">{suggestion.title}</h3>
              <div className="suggestion-item-description" dangerouslySetInnerHTML={{ __html: suggestion.description.replace(/\n/g, '<br/>') }} />
            </div>

            {suggestion.decision && (
              <div className="suggestion-decision">
                <div className="suggestion-decision-label">Beslut</div>
                <div className="suggestion-decision-text">{suggestion.decision}</div>
                {suggestion.decidedBy && (
                  <div className="suggestion-decision-meta">
                    — {suggestion.decidedBy}{suggestion.decidedAt ? `, ${formatDate(suggestion.decidedAt)}` : ''}
                  </div>
                )}
              </div>
            )}

            {/* Voting */}
            <div className="suggestion-vote-section">
              <button
                className={`suggestion-vote-btn ${hasVoted ? 'voted' : ''}`}
                onClick={() => handleVote(suggestion.id)}
                disabled={isLocked || !voteName.trim()}
                title={!voteName.trim() ? 'Ange ditt namn först' : hasVoted ? 'Ta bort röst' : 'Rösta för detta förslag'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={hasVoted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                <span>{suggestion.votes.length}</span>
              </button>
              {suggestion.votes.length > 0 && (
                <span className="suggestion-voters">
                  {suggestion.votes.map(v => v.name).join(', ')}
                </span>
              )}
            </div>

            {/* Comments */}
            <div className="log-divider"></div>
            <div className="log-interactions">
              {!isLocked && (
                <button
                  className="interaction-btn"
                  onClick={() => setCommentingId(commentingId === suggestion.id ? null : suggestion.id)}
                >
                  Kommentera
                </button>
              )}
              {commentCount > 0 && (
                <button
                  className="interaction-btn"
                  onClick={() => {
                    setExpandedComments(prev => {
                      const next = new Set(prev)
                      if (next.has(suggestion.id)) next.delete(suggestion.id)
                      else next.add(suggestion.id)
                      return next
                    })
                  }}
                >
                  {isExpanded ? 'Dölj' : 'Visa'} {commentCount} {commentCount === 1 ? 'kommentar' : 'kommentarer'}
                </button>
              )}
            </div>

            {commentingId === suggestion.id && (
              <SuggestionCommentForm
                onSubmit={(message, author) => {
                  handleComment(suggestion.id, message, author)
                  setCommentingId(null)
                }}
                onCancel={() => setCommentingId(null)}
              />
            )}

            {isExpanded && suggestion.comments.length > 0 && (
              <div className="comments-section">
                {suggestion.comments.map(comment => (
                  <SuggestionCommentItem
                    key={comment.id}
                    comment={comment}
                    suggestionId={suggestion.id}
                    isLocked={isLocked}
                    onReply={(message, author) => handleComment(suggestion.id, message, author, comment.id)}
                    onDelete={(commentId, parentId) => handleDeleteComment(suggestion.id, commentId, parentId)}
                  />
                ))}
              </div>
            )}

            {isLocked && (
              <div className="suggestion-locked-notice">
                Detta förslag är låst och kan inte längre kommenteras.
              </div>
            )}
          </article>
        )
      })}

      {deleteConfirm && (
        <ConfirmModal
          title="Ta bort förslag"
          message="Är du säker på att du vill ta bort detta förslag?"
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={async () => {
            try {
              await authenticatedFetch(`/api/admin/suggestions/${deleteConfirm}`, { method: 'DELETE' })
              setSuggestions(prev => prev.filter(s => s.id !== deleteConfirm))
            } catch (error) {
              console.error('Failed to delete:', error)
            }
            setDeleteConfirm(null)
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  )
}

// --- Sub-components ---

function CreateSuggestionForm({ onSubmit, onCancel }: {
  onSubmit: (title: string, description: string, author: string, category: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('övrigt')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !author.trim()) return
    setSubmitting(true)
    await onSubmit(title.trim(), description.trim(), author.trim(), category)
    setSubmitting(false)
  }

  return (
    <div className="suggestion-form">
      <h3>Lämna ett förslag</h3>
      <div className="suggestion-form-row">
        <input
          type="text"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Ditt namn"
          className="suggestion-form-input"
          autoFocus
        />
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="suggestion-form-select"
        >
          {CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Rubrik på förslaget"
        className="suggestion-form-input"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Beskriv ditt förslag i detalj..."
        className="suggestion-form-textarea"
        rows={4}
      />
      <div className="suggestion-form-actions">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !description.trim() || !author.trim()}
        >
          {submitting ? 'Skickar...' : 'Skicka förslag'}
        </button>
        <button className="edit-cancel" onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  )
}

function SuggestionCommentForm({ onSubmit, onCancel, placeholder }: {
  onSubmit: (message: string, author: string) => void
  onCancel: () => void
  placeholder?: string
}) {
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')

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
          onClick={() => {
            if (author.trim() && message.trim()) {
              onSubmit(message.trim(), author.trim())
            }
          }}
          disabled={!author.trim() || !message.trim()}
        >
          Skicka
        </button>
        <button className="comment-cancel" onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  )
}

function SuggestionCommentItem({ comment, suggestionId, isLocked, onReply, onDelete }: {
  comment: SuggestionComment
  suggestionId: number
  isLocked: boolean
  onReply: (message: string, author: string) => void
  onDelete: (commentId: number, parentId?: number) => void
}) {
  const [showReplyForm, setShowReplyForm] = useState(false)

  return (
    <div className="comment-item">
      <div className="comment-header">
        <div className="comment-avatar" style={{ background: getAvatarColor(comment.author) }}>
          {getInitials(comment.author)}
        </div>
        <div className="comment-meta">
          <span className="comment-author">{comment.author}</span>
          <span className="comment-date">{formatDate(comment.createdAt)}</span>
        </div>
        <button className="delete-btn" onClick={() => onDelete(comment.id)} title="Ta bort">&times;</button>
      </div>
      <div className="comment-message">{comment.message}</div>
      <div className="comment-footer">
        {!showReplyForm && !isLocked && (
          <button className="reply-btn" onClick={() => setShowReplyForm(true)}>Svara</button>
        )}
      </div>
      {showReplyForm && (
        <SuggestionCommentForm
          onSubmit={(message, author) => {
            onReply(message, author)
            setShowReplyForm(false)
          }}
          onCancel={() => setShowReplyForm(false)}
          placeholder="Skriv ett svar..."
        />
      )}
      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map(reply => (
            <SuggestionCommentItem
              key={reply.id}
              comment={reply}
              suggestionId={suggestionId}
              isLocked={isLocked}
              onReply={onReply}
              onDelete={(commentId) => onDelete(commentId, comment.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
