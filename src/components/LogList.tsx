import { useState, useRef, useEffect, memo } from 'react'
import type { LogAttachment, LogMessage, ReadSignature, Comment, Reaction } from '../App'
import ImageModal from './ImageModal'

interface LogListProps {
  logs: LogMessage[]
  loading: boolean
  onSign: (logId: number, signature: ReadSignature) => void
  onPin: (logId: number) => void
  onComment: (logId: number, comment: Comment, parentId?: number) => void
  onEditLog: (logId: number, title: string, message: string, imageUrl: string | null, attachments: Array<Omit<LogAttachment, 'id' | 'logId' | 'createdAt'>>) => void
  onDeleteComment: (logId: number, commentId: number, parentId?: number) => void
  onReaction: (logId: number, emoji: string) => void
  onDeleteLog: (logId: number) => void
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

// Memoized date formatting cache
const dateFormatCache = new Map<string, string>()
let lastCacheClear = Date.now()

function formatDate(dateString: string): string {
  // Clear cache every minute to update relative times
  const now = Date.now()
  if (now - lastCacheClear > 60000) {
    dateFormatCache.clear()
    lastCacheClear = now
  }

  // Check cache first
  if (dateFormatCache.has(dateString)) {
    return dateFormatCache.get(dateString)!
  }

  const date = new Date(dateString)
  const nowDate = new Date()
  const diffMs = nowDate.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let result: string
  if (diffMins < 1) result = 'Just nu'
  else if (diffMins < 60) result = `${diffMins} min`
  else if (diffHours < 24) result = `${diffHours} tim`
  else if (diffDays < 7) result = `${diffDays} d`
  else {
    result = date.toLocaleDateString('sv-SE', {
      day: 'numeric',
      month: 'short'
    })
  }

  dateFormatCache.set(dateString, result)
  return result
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

// Memoized avatar color cache
const avatarColorCache = new Map<string, string>()

function getAvatarColor(name: string): string {
  if (avatarColorCache.has(name)) {
    return avatarColorCache.get(name)!
  }

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
  const color = colors[index]
  avatarColorCache.set(name, color)
  return color
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
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/logs/${logId}/sign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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
  initialImageUrl: string | null
  initialAttachments?: LogAttachment[]
  logId: number
  onSave: (title: string, message: string, imageUrl: string | null, attachments: Array<Omit<LogAttachment, 'id' | 'logId' | 'createdAt'>>) => void
  onCancel: () => void
  onDelete: (logId: number) => void
}

interface ImageFile {
  filename: string
  url: string
  uploadedAt: string
}

function EditForm({ initialTitle, initialMessage, initialImageUrl, initialAttachments = [], logId, onSave, onCancel, onDelete }: EditFormProps) {
  const [title, setTitle] = useState(initialTitle)
  const [message, setMessage] = useState(initialMessage)
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl)
  const [attachments, setAttachments] = useState<Array<Omit<LogAttachment, 'id' | 'logId' | 'createdAt'>>>(() =>
    initialAttachments.map(a => ({
      filename: a.filename,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      url: a.url
    }))
  )
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [availableImages, setAvailableImages] = useState<ImageFile[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)

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
      // Debounce the update to reduce lag
      const content = editorRef.current.innerHTML
      requestAnimationFrame(() => {
        setMessage(content)
      })
    }
  }

  const loadAvailableImages = async () => {
    setLoadingImages(true)
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/images', {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })
      if (res.ok) {
        const images = await res.json()
        setAvailableImages(images)
      }
    } catch (error) {
      console.error('Failed to load images:', error)
    } finally {
      setLoadingImages(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setImageUrl(data.url)
        setShowImagePicker(false)
        loadAvailableImages()
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleSelectImage = (url: string) => {
    setImageUrl(url)
    setShowImagePicker(false)
  }

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAttachment(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/attachments/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setAttachments(prev => [...prev, data])
        if (attachmentInputRef.current) attachmentInputRef.current.value = ''
      } else {
        const err = await res.json().catch(() => null)
        alert(err?.error || 'Kunde inte ladda upp fil')
      }
    } catch (error) {
      console.error('Failed to upload attachment:', error)
      alert('Kunde inte ladda upp fil')
    } finally {
      setUploadingAttachment(false)
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
      <div className="form-row">
        <div className="input-group">
          <label>Bild (valfritt)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: 'none' }}
          />
          <div className="image-upload-area">
            {imageUrl ? (
              <div className="image-preview">
                <img src={imageUrl} alt="Preview" />
                <button
                  type="button"
                  className="image-remove"
                  onClick={() => {
                    setImageUrl(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  &times;
                </button>
              </div>
            ) : (
              <div className="image-upload-options">
                <button
                  type="button"
                  className="image-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? 'Laddar upp...' : '+ Ladda upp ny bild'}
                </button>
                <button
                  type="button"
                  className="image-select-btn"
                  onClick={() => {
                    setShowImagePicker(!showImagePicker)
                    if (!showImagePicker) {
                      loadAvailableImages()
                    }
                  }}
                >
                  {showImagePicker ? 'Dölj' : 'Välj'} från tidigare bilder
                </button>
              </div>
            )}
            {showImagePicker && !imageUrl && (
              <div className="image-picker">
                {loadingImages ? (
                  <div className="image-picker-loading">Laddar bilder...</div>
                ) : availableImages.length === 0 ? (
                  <div className="image-picker-empty">Inga bilder tillgängliga</div>
                ) : (
                  <div className="image-picker-grid">
                    {availableImages.map((img) => (
                      <div
                        key={img.filename}
                        className="image-picker-item"
                        onClick={() => handleSelectImage(img.url)}
                      >
                        <img src={img.url} alt={img.filename} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="form-row">
        <div className="input-group">
          <label>Bifogade dokument (valfritt)</label>
          <input
            ref={attachmentInputRef}
            type="file"
            onChange={handleAttachmentUpload}
            style={{ display: 'none' }}
          />
          <div className="attachment-upload-area">
            <button
              type="button"
              className="attachment-upload-btn"
              onClick={() => attachmentInputRef.current?.click()}
              disabled={uploadingAttachment}
            >
              {uploadingAttachment ? 'Laddar upp...' : '+ Ladda upp dokument'}
            </button>
            {attachments.length > 0 && (
              <div className="attachments-list">
                {attachments.map((a, idx) => (
                  <div key={`${a.filename}-${idx}`} className="attachment-item">
                    <a href={a.url} target="_blank" rel="noreferrer" className="attachment-link">
                      {a.originalName}
                    </a>
                    <button
                      type="button"
                      className="attachment-remove"
                      onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                      title="Ta bort bilaga"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="edit-actions">
        <button 
          className="edit-save" 
          onClick={() => onSave(title, message, imageUrl, attachments)}
          disabled={!plainText}
        >
          Spara
        </button>
        <button className="edit-cancel" onClick={onCancel}>
          Avbryt
        </button>
        <button 
          className="edit-delete" 
          onClick={() => onDelete(logId)}
          title="Ta bort inlägg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
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
      const token = localStorage.getItem('authToken')
      const res = await fetch(`/api/logs/${logId}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
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

const CommentItem = memo(function CommentItem({ comment, logId, onComment, onDelete, parentId }: CommentItemProps) {
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
})

export default function LogList({ logs, loading, onSign, onPin, onComment, onEditLog, onDeleteComment, onReaction, onDeleteLog }: LogListProps) {
  const [signingId, setSigningId] = useState<number | null>(null)
  const [commentingId, setCommentingId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [expandedComments, setExpandedComments] = useState<Set<number>>(new Set())
  const [showReactionPicker, setShowReactionPicker] = useState<number | null>(null)
  const [reactionCooldown, setReactionCooldown] = useState<Set<number>>(new Set())
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

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
                initialImageUrl={log.imageUrl}
                initialAttachments={log.attachments || []}
                logId={log.id}
                onSave={(title, message, imageUrl, attachments) => {
                  onEditLog(log.id, title, message, imageUrl, attachments)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
                onDelete={onDeleteLog}
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
                {log.imageUrl && (
                  <div className="log-image" onClick={() => setFullscreenImage(log.imageUrl!)}>
                    <img src={log.imageUrl} alt="Inläggsbild" />
                  </div>
                )}
                {log.attachments && log.attachments.length > 0 && (
                  <div className="log-attachments">
                    <div className="log-attachments-title">Bifogade dokument</div>
                    <ul className="log-attachments-list">
                      {log.attachments.map((a) => (
                        <li key={a.id} className="log-attachment-item">
                          <a href={a.url} target="_blank" rel="noreferrer" className="log-attachment-link">
                            {a.originalName}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {fullscreenImage && (
              <ImageModal imageUrl={fullscreenImage} onClose={() => setFullscreenImage(null)} />
            )}
            
            {/* Reactions */}
            <div className="reactions-section">
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
            </div>

            {/* Divider and comments section */}
            <div className="log-divider"></div>
            
            <div className="log-interactions">
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
