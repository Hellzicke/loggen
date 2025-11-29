import { useState, FormEvent, useEffect, useRef } from 'react'
import type { LogMessage } from '../App'
import RichTextEditor from './RichTextEditor'

interface LogFormProps {
  onSuccess: (log: LogMessage) => void
  onClose: () => void
}

export default function LogForm({ onSuccess, onClose }: LogFormProps) {
  const [author, setAuthor] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setImageUrl(data.url)
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Strip HTML tags to check if there's actual content
    const plainText = message.replace(/<[^>]*>/g, '').trim()
    if (!author.trim() || !plainText) return

    setSubmitting(true)
    
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          author: author.trim(), 
          title: title.trim(),
          message: message.trim(),
          imageUrl
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
              <label>Meddelande</label>
              <RichTextEditor
                value={message}
                onChange={setMessage}
                placeholder="Vad vill du dela?"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="input-group">
              <label htmlFor="image">Bild (valfritt)</label>
              <input
                ref={fileInputRef}
                id="image"
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
                  <button
                    type="button"
                    className="image-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Laddar upp...' : '+ Lägg till bild'}
                  </button>
                )}
              </div>
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
