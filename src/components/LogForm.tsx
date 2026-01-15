import { useState, FormEvent, useEffect, useRef } from 'react'
import type { LogAttachment, LogMessage } from '../App'
import RichTextEditor, { RichTextEditorRef } from './RichTextEditor'

interface LogFormProps {
  onSuccess: (log: LogMessage) => void
  onClose: () => void
}

interface ImageFile {
  filename: string
  url: string
  uploadedAt: string
}

export default function LogForm({ onSuccess, onClose }: LogFormProps) {
  const [author, setAuthor] = useState('')
  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [availableImages, setAvailableImages] = useState<ImageFile[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [attachments, setAttachments] = useState<Array<Omit<LogAttachment, 'id' | 'logId' | 'createdAt'>>>([])
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<RichTextEditorRef>(null)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    // Get message directly from editor ref - no state involved
    const message = editorRef.current?.getValue() || ''
    
    // Strip HTML tags to check if there's actual content
    const plainText = message.replace(/<[^>]*>/g, '').trim()
    if (!author.trim() || !plainText) return

    setSubmitting(true)
    
    try {
      const token = localStorage.getItem('authToken')
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          author: author.trim(), 
          title: title.trim(),
          message: message.trim(),
          imageUrl,
          attachments
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

  const mouseDownTarget = useRef<EventTarget | null>(null)

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Store where the mouse was pressed down
    if (e.target === e.currentTarget) {
      mouseDownTarget.current = e.target
    } else {
      mouseDownTarget.current = null
    }
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only close if mouse was pressed down AND released on overlay (not dragged from form)
    if (e.target === e.currentTarget && mouseDownTarget.current === e.currentTarget) {
      onClose()
    }
    mouseDownTarget.current = null
  }

  return (
    <div className="form-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <form className="log-form" onSubmit={handleSubmit} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
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
                ref={editorRef}
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
              <label htmlFor="attachment">Bifogade dokument (valfritt)</label>
              <input
                ref={attachmentInputRef}
                id="attachment"
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
