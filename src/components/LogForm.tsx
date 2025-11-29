import { useState, FormEvent, useEffect } from 'react'

interface LogMessage {
  id: number
  message: string
  author: string
  version: string
  createdAt: string
}

interface LogFormProps {
  onSuccess: (log: LogMessage) => void
  onClose: () => void
}

export default function LogForm({ onSuccess, onClose }: LogFormProps) {
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!author.trim() || !message.trim()) return

    setSubmitting(true)
    
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: author.trim(), message: message.trim() })
      })

      if (res.ok) {
        const log = await res.json()
        onSuccess(log)
      }
    } catch (error) {
      console.error('Failed to create log:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="form-overlay" onClick={onClose}>
      <form className="log-form" onSubmit={handleSubmit} onClick={e => e.stopPropagation()}>
        <div className="form-header">
          <h2>Skapa inlägg</h2>
          <button type="button" className="form-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="form-body">
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="author">Namn</label>
              <input
                id="author"
                type="text"
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder="Ditt namn"
                autoFocus
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="message">Meddelande</label>
              <textarea
                id="message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Vad vill du dela?"
                required
              />
            </div>
          </div>
          <div className="form-row">
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Publicerar...' : 'Publicera'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
