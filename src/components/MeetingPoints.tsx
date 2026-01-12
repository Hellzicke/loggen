import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from './ConfirmModal'

interface MeetingPoint {
  id: number
  title: string
  description: string | null
  author: string
  createdAt: string
}

interface Meeting {
  id: number
  title: string
  scheduledAt: string
  createdAt: string
  updatedAt: string
  points: MeetingPoint[]
}

interface MeetingPointsProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
}

export default function MeetingPoints({ authenticatedFetch }: MeetingPointsProps) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null)
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pointTitle, setPointTitle] = useState('')
  const [pointDescription, setPointDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingPointId, setEditingPointId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)

  const loadMeetings = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/meetings/upcoming')
      if (res.ok) {
        const data = await res.json()
        setMeetings(data)
        // Auto-select first meeting if available
        if (data.length > 0 && !selectedMeetingId) {
          setSelectedMeetingId(data[0].id)
          setMeeting(data[0])
        } else if (data.length === 0) {
          setMeeting(null)
          setSelectedMeetingId(null)
        }
      }
    } catch (error) {
      console.error('Error loading meetings:', error)
    } finally {
      setLoading(false)
    }
  }, [authenticatedFetch, selectedMeetingId])

  const loadMeeting = useCallback(async (meetingId: number) => {
    try {
      const res = await authenticatedFetch(`/api/meetings/${meetingId}`)
      if (res.ok) {
        const data = await res.json()
        setMeeting(data)
      } else if (res.status === 404) {
        setMeeting(null)
      }
    } catch (error) {
      console.error('Error loading meeting:', error)
    }
  }, [authenticatedFetch])

  const handleMeetingSelect = (meetingId: number) => {
    setSelectedMeetingId(meetingId)
    loadMeeting(meetingId)
    setShowForm(false)
    setEditingPointId(null)
  }

  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  useEffect(() => {
    if (selectedMeetingId) {
      loadMeeting(selectedMeetingId)
    }
  }, [selectedMeetingId, loadMeeting])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!meeting || !pointTitle.trim() || !author.trim()) return

    setSubmitting(true)
    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: pointTitle.trim(),
          description: pointDescription.trim() || null,
          author: author.trim()
        })
      })

      if (res.ok) {
        setPointTitle('')
        setPointDescription('')
        setAuthor('')
        setShowForm(false)
        loadMeetings()
        if (selectedMeetingId) {
          loadMeeting(selectedMeetingId)
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Kunde inte lägga till punkt')
      }
    } catch (error) {
      console.error('Error submitting point:', error)
      alert('Ett fel uppstod vid inlämning av punkt')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (point: MeetingPoint) => {
    setEditingPointId(point.id)
    setEditTitle(point.title)
    setEditDescription(point.description || '')
    setEditAuthor(point.author)
    setShowForm(false)
    setShowDeleteConfirm(null)
  }

  const handleCancelEdit = () => {
    setEditingPointId(null)
    setEditTitle('')
    setEditDescription('')
    setEditAuthor('')
    setShowDeleteConfirm(null)
  }

  const handleSaveEdit = async (pointId: number) => {
    if (!meeting || !editTitle.trim() || !editAuthor.trim()) return

    setSubmitting(true)
    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          author: editAuthor.trim()
        })
      })

      if (res.ok) {
        handleCancelEdit()
        loadMeetings()
        if (selectedMeetingId) {
          loadMeeting(selectedMeetingId)
        }
      } else {
        const data = await res.json()
        alert(data.error || 'Kunde inte uppdatera punkt')
      }
    } catch (error) {
      console.error('Error updating point:', error)
      alert('Ett fel uppstod vid uppdatering av punkt')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePoint = async (pointId: number) => {
    if (!meeting) return
    setShowDeleteConfirm(null)
    
    // Close edit form if deleting the point being edited
    if (editingPointId === pointId) {
      handleCancelEdit()
    }

    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points/${pointId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadMeetings()
        if (selectedMeetingId) {
          loadMeeting(selectedMeetingId)
        }
      } else {
        alert('Kunde inte ta bort punkten')
      }
    } catch (error) {
      console.error('Error deleting point:', error)
      alert('Ett fel uppstod vid borttagning av punkt')
    }
  }

  if (loading) {
    return <div className="loading">Laddar...</div>
  }

  if (loading) {
    return <div className="loading">Laddar...</div>
  }

  if (meetings.length === 0) {
    return (
      <div className="meeting-points-container">
        <div className="no-meeting">
          <h2>Inga kommande möten</h2>
          <p>Det finns inga planerade möten just nu.</p>
        </div>
      </div>
    )
  }

  if (!meeting && selectedMeetingId) {
    return <div className="loading">Laddar möte...</div>
  }

  if (!meeting) {
    return (
      <div className="meeting-points-container">
        <div className="no-meeting">
          <h2>Välj ett möte</h2>
          <p>Välj ett möte från listan för att se agendapunkter.</p>
        </div>
      </div>
    )
  }

  const meetingDate = new Date(meeting.scheduledAt)
  const isPast = meetingDate < new Date()

  return (
    <div className="meeting-points-container">
      {meetings.length > 1 && (
        <div className="meetings-selector">
          <h3>Välj möte</h3>
          <div className="meetings-list-selector">
            {meetings.map((m) => {
              const mDate = new Date(m.scheduledAt)
              return (
                <button
                  key={m.id}
                  className={`meeting-selector-btn ${selectedMeetingId === m.id ? 'meeting-selector-btn--active' : ''}`}
                  onClick={() => handleMeetingSelect(m.id)}
                >
                  <div className="meeting-selector-title">{m.title}</div>
                  <div className="meeting-selector-date">
                    {mDate.toLocaleString('sv-SE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  <div className="meeting-selector-points">{m.points.length} punkter</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div className="meeting-header-card">
        <div className="meeting-header-badge">Möte</div>
        <h2 className="meeting-title">{meeting.title}</h2>
        <div className="meeting-meta">
          <span className="meeting-date-display">
            {meetingDate.toLocaleString('sv-SE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {isPast && <span className="meeting-past-badge">Mötet har redan ägt rum</span>}
        </div>
      </div>

      <div className="meeting-points-section">
        <div className="meeting-points-header">
          <h3>Agendapunkter för detta möte ({meeting.points.length})</h3>
          {!isPast && (
            <button
              className={`meeting-add-btn ${showForm ? 'meeting-add-btn--cancel' : ''}`}
              onClick={() => setShowForm(!showForm)}
            >
              {showForm ? 'Avbryt' : '+ Lägg till punkt'}
            </button>
          )}
        </div>

      {showForm && !isPast && (
        <div className="point-form-card">
          <h4>Ny agendapunkt</h4>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Ditt namn *</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                className="meeting-input"
              />
            </div>
            <div className="input-group">
              <label>Titel *</label>
              <input
                type="text"
                value={pointTitle}
                onChange={(e) => setPointTitle(e.target.value)}
                required
                placeholder="Ex: Uppdatering av projekt X"
                className="meeting-input"
              />
            </div>
            <div className="input-group">
              <label>Beskrivning (valfritt)</label>
              <textarea
                value={pointDescription}
                onChange={(e) => setPointDescription(e.target.value)}
                rows={4}
                placeholder="Beskriv vad du vill diskutera..."
                className="meeting-textarea"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="meeting-submit-btn"
            >
              {submitting ? 'Lägger till...' : 'Lägg till'}
            </button>
          </form>
        </div>
      )}

      {meeting.points.length === 0 ? (
        <div className="no-points">
          <p>Inga agendapunkter har lagts till ännu.</p>
        </div>
      ) : (
        <div className="points-list">
          {meeting.points.map((point) => (
            <div key={point.id} className="point-item-card point-item-card--linked">
              <div className="point-meeting-indicator"></div>
              {editingPointId === point.id ? (
                <div className="point-edit-form">
                  <h4>Redigera agendapunkt</h4>
                  <div className="input-group">
                    <label>Ditt namn *</label>
                    <input
                      type="text"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      required
                      className="meeting-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Titel *</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      required
                      className="meeting-input"
                    />
                  </div>
                  <div className="input-group">
                    <label>Beskrivning (valfritt)</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="meeting-textarea"
                    />
                  </div>
                  <div className="point-edit-actions">
                    <button
                      type="button"
                      className="meeting-submit-btn"
                      onClick={() => handleSaveEdit(point.id)}
                      disabled={submitting || !editTitle.trim() || !editAuthor.trim()}
                    >
                      {submitting ? 'Sparar...' : 'Spara'}
                    </button>
                    <button
                      type="button"
                      className="point-cancel-btn"
                      onClick={handleCancelEdit}
                      disabled={submitting}
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      className="point-delete-in-edit-btn"
                      onClick={() => setShowDeleteConfirm(point.id)}
                      disabled={submitting}
                    >
                      Ta bort
                    </button>
                  </div>
                </div>
              ) : (
                <div className="point-item-content">
                  <div className="point-item-main">
                    <h4 className="point-title">{point.title}</h4>
                    {point.description && (
                      <p className="point-description">{point.description}</p>
                    )}
                    <div className="point-meta">
                      <span>Förslag av: {point.author}</span>
                      <span className="point-date">
                        {new Date(point.createdAt).toLocaleDateString('sv-SE', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  {!isPast && (
                    <div className="point-actions">
                      <button
                        className="point-edit-btn"
                        onClick={() => handleStartEdit(point)}
                        title="Redigera"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {showDeleteConfirm === point.id && (
                <ConfirmModal
                  title="Ta bort agendapunkt"
                  message="Är du säker på att du vill ta bort denna punkt? Detta går inte att ångra."
                  confirmText="Ta bort"
                  cancelText="Avbryt"
                  onConfirm={() => handleDeletePoint(point.id)}
                  onCancel={() => setShowDeleteConfirm(null)}
                />
              )}
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  )
}

