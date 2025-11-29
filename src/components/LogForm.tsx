import { useState, FormEvent } from 'react'

interface LogMessage {
  id: number
  message: string
  author: string
  version: string
  createdAt: string
}

interface LogFormProps {
  onSuccess: (log: LogMessage) => void
}

export default function LogForm({ onSuccess }: LogFormProps) {
  const [author, setAuthor] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

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
        setMessage('')
      }
    } catch (error) {
      console.error('Failed to create log:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="log-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="input-group">
          <label htmlFor="author">Namn</label>
          <input
            id="author"
            type="text"
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="Ditt namn"
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
            placeholder="Skriv ditt meddelande..."
            required
          />
        </div>
      </div>
      <div className="form-row">
        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? 'Skickar...' : 'Skicka'}
        </button>
      </div>
    </form>
  )
}

