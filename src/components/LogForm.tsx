import { useState, FormEvent, useEffect, useRef } from 'react'
import type { LogMessage } from '../App'

interface LogFormProps {
  onSuccess: (log: LogMessage) => void
  onClose: () => void
}

export default function LogForm({ onSuccess, onClose }: LogFormProps) {
  const [author, setAuthor] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const insertFormat = (before: string, after: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = message.substring(start, end)
    
    const newText = message.substring(0, start) + before + selectedText + after + message.substring(end)
    setMessage(newText)
    
    // Set cursor position after formatting
    setTimeout(() => {
      textarea.focus()
      if (selectedText) {
        textarea.setSelectionRange(start + before.length, end + before.length)
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length)
      }
    }, 0)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!author.trim() || !message.trim()) return

    setSubmitting(true)
    
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          author: author.trim(), 
          title: title.trim(),
          message: message.trim() 
        })
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
              <label htmlFor="title">Rubrik</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Rubrik på inlägget"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="message">Meddelande</label>
              <div className="format-toolbar">
                <button 
                  type="button" 
                  className="format-btn format-btn--bold"
                  onClick={() => insertFormat('**', '**')}
                  title="Fet (Ctrl+B)"
                >
                  B
                </button>
                <button 
                  type="button" 
                  className="format-btn format-btn--italic"
                  onClick={() => insertFormat('*', '*')}
                  title="Kursiv (Ctrl+I)"
                >
                  I
                </button>
                <button 
                  type="button" 
                  className="format-btn format-btn--underline"
                  onClick={() => insertFormat('__', '__')}
                  title="Understruken (Ctrl+U)"
                >
                  U
                </button>
              </div>
              <textarea
                ref={textareaRef}
                id="message"
                className="has-toolbar"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Vad vill du dela? Använd **fet**, *kursiv* eller __understruken__"
                required
                onKeyDown={e => {
                  if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'b') {
                      e.preventDefault()
                      insertFormat('**', '**')
                    } else if (e.key === 'i') {
                      e.preventDefault()
                      insertFormat('*', '*')
                    } else if (e.key === 'u') {
                      e.preventDefault()
                      insertFormat('__', '__')
                    }
                  }
                }}
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
