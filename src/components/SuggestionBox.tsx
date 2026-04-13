import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from './ConfirmModal'
import EmployeeNameInput from './EmployeeNameInput'

interface SuggestionVote {
  id: number
  name: string
  value: number
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
  type: string
  system: string | null
  fixedInVersion: string | null
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
  filter?: 'förslag' | 'förslag-arkiv' | 'bugg' | 'funktion'
}

const SYSTEMS = ['Loggen', 'Schema', 'Fish', 'Poolportalen']
const TYPES = [
  { value: 'förslag', label: 'Förslag' },
  { value: 'bugg', label: 'Buggrapport' },
  { value: 'funktion', label: 'Funktionsönskemål' },
]

const TYPE_LABELS: Record<string, string> = {
  förslag: 'Förslag',
  bugg: 'Bugg',
  funktion: 'Funktion',
}

const TYPE_COLORS: Record<string, string> = {
  förslag: '#667eea',
  bugg: '#e5484d',
  funktion: '#42b883',
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

export default function SuggestionBox({ authenticatedFetch, filter = 'förslag' }: SuggestionBoxProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [archivedSuggestions, setArchivedSuggestions] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [commentingId, setCommentingId] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  // Namn sparas i minnet bara för nuvarande session, så nästa person vid datorn
  // börjar med blankt fält. Rensas vid sidomladdning eller via "Byt användare".
  const [currentVoter, setCurrentVoter] = useState<string>('')
  const [votePromptFor, setVotePromptFor] = useState<{ suggestionId: number; value: 1 | -1 } | null>(null)
  const [promptName, setPromptName] = useState('')

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

  const submitVote = async (suggestionId: number, value: 1 | -1, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const res = await authenticatedFetch(`/api/suggestions/${suggestionId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ name: trimmed, value })
      })
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(prev => prev.map(s => {
        if (s.id !== suggestionId) return s
        const others = s.votes.filter(v => v.name !== trimmed)
        if (data.removed) return { ...s, votes: others }
        return { ...s, votes: [...others, data] }
      }))
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  const handleVoteClick = (suggestionId: number, value: 1 | -1) => {
    if (currentVoter.trim()) {
      submitVote(suggestionId, value, currentVoter)
    } else {
      setVotePromptFor({ suggestionId, value })
      setPromptName('')
    }
  }

  const confirmPromptVote = () => {
    if (!votePromptFor || !promptName.trim()) return
    const name = promptName.trim()
    setCurrentVoter(name)
    submitVote(votePromptFor.suggestionId, votePromptFor.value, name)
    setVotePromptFor(null)
    setPromptName('')
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

  const handleCreate = async (title: string, description: string, author: string, category: string, type: string, system: string | null) => {
    try {
      const res = await authenticatedFetch('/api/suggestions', {
        method: 'POST',
        body: JSON.stringify({ title, description, author, category, type, system })
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

  const showArchivedView = filter === 'förslag-arkiv'

  useEffect(() => {
    if (showArchivedView) fetchArchivedSuggestions()
  }, [showArchivedView, fetchArchivedSuggestions])

  const archivedFiltered = archivedSuggestions.filter(s => s.type === 'förslag' || !s.type)

  const sortedSuggestions = [...suggestions]
    .filter(s => {
      if (filter === 'bugg') return s.type === 'bugg'
      if (filter === 'funktion') return s.type === 'funktion'
      return s.type === 'förslag' || !s.type
    })
    .filter(s => filterCategory === 'all' || s.category === filterCategory)
    .sort((a, b) => {
      const statusOrder: Record<string, number> = { open: 0, in_review: 1, decided: 2, locked: 3 }
      const orderDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0)
      if (orderDiff !== 0) return orderDiff
      const scoreA = a.votes.reduce((sum, v) => sum + (v.value ?? 1), 0)
      const scoreB = b.votes.reduce((sum, v) => sum + (v.value ?? 1), 0)
      return scoreB - scoreA
    })

  const countComments = (comments: SuggestionComment[]): number =>
    comments.reduce((total, c) => total + 1 + (c.replies?.length || 0), 0)

  if (loading) return <div className="loading">Laddar...</div>

  return (
    <div className="suggestion-box">
      <div className="suggestion-header-bar">
        <div className="suggestion-actions-left">
          {filter !== 'förslag-arkiv' && (
            <button className="suggestion-create-btn" onClick={() => setShowForm(true)}>
              {filter === 'bugg' ? '+ Rapportera bugg' : filter === 'funktion' ? '+ Önska funktion' : '+ Nytt förslag'}
            </button>
          )}
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
          {currentVoter && (
            <div className="suggestion-current-voter">
              Röstar som: <strong>{currentVoter}</strong>
              <button
                type="button"
                className="suggestion-switch-user"
                onClick={() => setCurrentVoter('')}
              >
                Byt användare
              </button>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <CreateSuggestionForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          initialType={filter === 'bugg' ? 'bugg' : filter === 'funktion' ? 'funktion' : 'förslag'}
          lockedType={filter === 'bugg' || filter === 'funktion'}
        />
      )}

      {sortedSuggestions.length === 0 && !showArchivedView && (
        <div className="empty-state">
          <p>{filter === 'bugg' ? 'Inga buggrapporter ännu.' : filter === 'funktion' ? 'Inga funktionsönskemål ännu.' : 'Inga förslag ännu. Var först med att lämna ett!'}</p>
        </div>
      )}

      {(showArchivedView ? archivedFiltered : sortedSuggestions).map(suggestion => {
        const commentCount = countComments(suggestion.comments)
        const isExpanded = expandedComments.has(suggestion.id)
        const isLocked = !!suggestion.lockedAt
        const myVote = currentVoter.trim()
          ? suggestion.votes.find(v => v.name === currentVoter.trim())?.value
          : undefined
        const upCount = suggestion.votes.filter(v => (v.value ?? 1) === 1).length
        const downCount = suggestion.votes.filter(v => v.value === -1).length
        const isPrompted = votePromptFor?.suggestionId === suggestion.id

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
                style={{ background: TYPE_COLORS[suggestion.type] || '#667eea' }}
              >
                {TYPE_LABELS[suggestion.type] || 'Förslag'}
              </span>
              {suggestion.system && (
                <span className="suggestion-system-badge">
                  {suggestion.system}
                </span>
              )}
              <span
                className="suggestion-status-badge"
                style={{ background: STATUS_COLORS[suggestion.status] || '#8a8d91' }}
              >
                {STATUS_LABELS[suggestion.status] || suggestion.status}
              </span>
              {suggestion.type === 'förslag' && (
                <span className="suggestion-category-badge">
                  {getCategoryLabel(suggestion.category)}
                </span>
              )}
              {suggestion.fixedInVersion && (
                <span className="suggestion-fixed-badge" title={`Fixad i version ${suggestion.fixedInVersion}`}>
                  ✓ Fixad i v{suggestion.fixedInVersion}
                </span>
              )}
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

            {/* Voting (endast för förslag, inte bugg/funktion) */}
            {suggestion.type === 'förslag' && (
            <>
            <div className="suggestion-vote-section">
              <button
                className={`suggestion-vote-btn ${myVote === 1 ? 'voted voted--up' : ''}`}
                onClick={() => handleVoteClick(suggestion.id, 1)}
                disabled={isLocked}
                title={myVote === 1 ? 'Ta bort röst' : 'Rösta för förslaget'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={myVote === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                <span>{upCount}</span>
              </button>
              <button
                className={`suggestion-vote-btn suggestion-vote-btn--down ${myVote === -1 ? 'voted voted--down' : ''}`}
                onClick={() => handleVoteClick(suggestion.id, -1)}
                disabled={isLocked}
                title={myVote === -1 ? 'Ta bort röst' : 'Rösta emot förslaget'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={myVote === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" style={{ transform: 'rotate(180deg)' }}>
                  <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
                </svg>
                <span>{downCount}</span>
              </button>
              {suggestion.votes.length > 0 && (
                <span className="suggestion-voters">
                  {suggestion.votes.map(v => `${v.name}${v.value === -1 ? ' (emot)' : ''}`).join(', ')}
                </span>
              )}
            </div>
            {isPrompted && (
              <div className="suggestion-vote-prompt">
                <label>
                  {votePromptFor?.value === 1 ? 'Rösta FÖR' : 'Rösta EMOT'} — ditt namn:
                </label>
                <EmployeeNameInput
                  value={promptName}
                  onChange={setPromptName}
                  selectClassName="vote-name-input"
                  inputClassName="vote-name-input"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') confirmPromptVote()
                    if (e.key === 'Escape') setVotePromptFor(null)
                  }}
                />
                <button
                  type="button"
                  className="comment-submit"
                  onClick={confirmPromptVote}
                  disabled={!promptName.trim()}
                >
                  Rösta
                </button>
                <button
                  type="button"
                  className="comment-cancel"
                  onClick={() => setVotePromptFor(null)}
                >
                  Avbryt
                </button>
              </div>
            )}
            </>
            )}

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

function CreateSuggestionForm({ onSubmit, onCancel, initialType = 'förslag', lockedType = false }: {
  onSubmit: (title: string, description: string, author: string, category: string, type: string, system: string | null) => void
  onCancel: () => void
  initialType?: string
  lockedType?: boolean
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState('övrigt')
  const [type, setType] = useState(initialType)
  const [system, setSystem] = useState<string>('Loggen')
  const [submitting, setSubmitting] = useState(false)

  const needsSystem = type === 'bugg' || type === 'funktion'

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim() || !author.trim()) return
    if (needsSystem && !system) return
    setSubmitting(true)
    await onSubmit(
      title.trim(),
      description.trim(),
      author.trim(),
      category,
      type,
      needsSystem ? system : null
    )
    setSubmitting(false)
  }

  const formTitle = type === 'bugg' ? 'Rapportera en bugg' : type === 'funktion' ? 'Önska en funktion' : 'Lämna ett förslag'
  const titlePlaceholder = type === 'bugg' ? 'Kort beskrivning av buggen' : type === 'funktion' ? 'Önskad funktion' : 'Rubrik på förslaget'
  const descPlaceholder = type === 'bugg'
    ? 'Beskriv buggen: vad hände, vad förväntades, hur kan den återskapas?'
    : type === 'funktion'
    ? 'Beskriv önskad funktion och hur den skulle användas...'
    : 'Beskriv ditt förslag i detalj...'

  return (
    <div className="suggestion-form">
      <h3>{formTitle}</h3>
      <div className="suggestion-form-row">
        <EmployeeNameInput
          value={author}
          onChange={setAuthor}
          selectClassName="suggestion-form-input"
          inputClassName="suggestion-form-input"
          autoFocus
        />
        {!lockedType && (
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="suggestion-form-select"
          >
            {TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}
        {type === 'förslag' && (
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="suggestion-form-select"
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        )}
        {needsSystem && (
          <select
            value={system}
            onChange={e => setSystem(e.target.value)}
            className="suggestion-form-select"
          >
            {SYSTEMS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder={titlePlaceholder}
        className="suggestion-form-input"
      />
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={descPlaceholder}
        className="suggestion-form-textarea"
        rows={4}
      />
      <div className="suggestion-form-actions">
        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !title.trim() || !description.trim() || !author.trim()}
        >
          {submitting ? 'Skickar...' : type === 'bugg' ? 'Skicka buggrapport' : type === 'funktion' ? 'Skicka önskemål' : 'Skicka förslag'}
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
      <EmployeeNameInput
        value={author}
        onChange={setAuthor}
        selectClassName="comment-input"
        inputClassName="comment-input"
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
