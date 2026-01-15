import { useState, useEffect, useCallback } from 'react'
import ConfirmModal from './ConfirmModal'

interface MeetingPoint {
  id: number
  title: string
  description: string | null
  author: string
  completed: boolean
  completedAt: string | null
  notes: string | null
  createdAt: string
}

interface Meeting {
  id: number
  title: string
  scheduledAt: string
  archived: boolean
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  points: MeetingPoint[]
}

interface MeetingPointsProps {
  authenticatedFetch: (url: string, options?: RequestInit) => Promise<Response>
}

// Generate consistent color for each meeting based on ID
function getMeetingColor(meetingId: number): { primary: string; light: string; border: string } {
  const colors = [
    { primary: '#1877f2', light: '#e7f3ff', border: '#1877f2' }, // Blå
    { primary: '#42b883', light: '#e8f5e9', border: '#42b883' }, // Grön
    { primary: '#f5576c', light: '#ffe5e9', border: '#f5576c' }, // Röd/Rosa
    { primary: '#667eea', light: '#ede7f6', border: '#667eea' }, // Lila
    { primary: '#f093fb', light: '#fce4ec', border: '#f093fb' }, // Rosa
    { primary: '#4facfe', light: '#e3f2fd', border: '#4facfe' }, // Ljusblå
    { primary: '#43e97b', light: '#e8f5e9', border: '#43e97b' }, // Mintgrön
    { primary: '#fa709a', light: '#fce4ec', border: '#fa709a' }, // Korall
    { primary: '#ff6b6b', light: '#ffebee', border: '#ff6b6b' }, // Röd
    { primary: '#6c5ce7', light: '#ede7f6', border: '#6c5ce7' }, // Lila
    { primary: '#00b894', light: '#e0f2f1', border: '#00b894' }, // Turkos
    { primary: '#fd79a8', light: '#fce4ec', border: '#fd79a8' }, // Rosa
  ]
  const index = (meetingId - 1) % colors.length
  return colors[index]
}

function getMonthKey(isoDate: string) {
  const d = new Date(isoDate)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function formatMonthLabel(monthKey: string) {
  // monthKey: YYYY-MM
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long' })
}

export default function MeetingPoints({ authenticatedFetch, showArchived = false }: MeetingPointsProps) {
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
  const [editNotes, setEditNotes] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null)
  const [showNotesEditor, setShowNotesEditor] = useState<number | null>(null)
  const [notesText, setNotesText] = useState('')
  const [archiving, setArchiving] = useState(false)

  const loadMeetings = useCallback(async () => {
    try {
      const endpoint = showArchived ? '/api/meetings/archived' : '/api/meetings/upcoming'
      const res = await authenticatedFetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        setMeetings(data)
        // Auto-select first meeting if available (active meetings view only)
        if (!showArchived && data.length > 0 && !selectedMeetingId) {
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
  }, [authenticatedFetch, selectedMeetingId, showArchived])

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

  // When toggling between active/archived, reset selection so the UI actually switches list & meeting.
  useEffect(() => {
    setSelectedMeetingId(null)
    setMeeting(null)
    setLoading(true)
  }, [showArchived])

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
    setEditNotes(point.notes || '')
    setShowForm(false)
    setShowDeleteConfirm(null)
    setShowNotesEditor(null)
  }

  const handleToggleComplete = async (pointId: number, currentlyCompleted: boolean) => {
    if (!meeting) return

    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          completed: !currentlyCompleted
        })
      })

      if (res.ok) {
        loadMeetings()
        if (selectedMeetingId) {
          loadMeeting(selectedMeetingId)
        }
      }
    } catch (error) {
      console.error('Error toggling completion:', error)
    }
  }

  const handleSaveNotes = async (pointId: number) => {
    if (!meeting) return

    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points/${pointId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: notesText
        })
      })

      if (res.ok) {
        setShowNotesEditor(null)
        setNotesText('')
        loadMeetings()
        if (selectedMeetingId) {
          loadMeeting(selectedMeetingId)
        }
      }
    } catch (error) {
      console.error('Error saving notes:', error)
    }
  }

  const handleArchiveMeeting = async () => {
    if (!meeting) return
    if (!confirm('Är du säker på att du vill arkivera detta möte? Du kan fortfarande se det i arkivet efteråt.')) return

    setArchiving(true)
    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/archive`, {
        method: 'POST'
      })

      if (res.ok) {
        loadMeetings()
        setSelectedMeetingId(null)
        setMeeting(null)
      } else {
        alert('Kunde inte arkivera mötet')
      }
    } catch (error) {
      console.error('Error archiving meeting:', error)
      alert('Ett fel uppstod vid arkivering av möte')
    } finally {
      setArchiving(false)
    }
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
          author: editAuthor.trim(),
          notes: editNotes.trim() || null
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

  if (meetings.length === 0) {
    return (
      <div className="meeting-points-container">
        <div className="no-meeting">
          <h2>{showArchived ? 'Inga arkiverade möten' : 'Inga aktiva möten'}</h2>
          <p>{showArchived ? 'Det finns inga arkiverade möten ännu.' : 'Det finns inga aktiva möten just nu.'}</p>
        </div>
      </div>
    )
  }

  if (showArchived) {
    const groups = meetings.reduce<Record<string, Meeting[]>>((acc, m) => {
      const key = getMonthKey(m.scheduledAt)
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
      return acc
    }, {})

    const groupKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a))
    for (const k of groupKeys) {
      groups[k].sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    }

    return (
      <div className="meeting-points-container">
        <div className="archived-meetings">
          <div className="archived-meetings-hint">
            Klicka på ett möte för att fälla ut och se agendapunkterna som behandlades.
          </div>
          {groupKeys.map((monthKey, monthIndex) => (
            <details key={monthKey} className="archived-month" open={monthIndex === 0}>
              <summary className="archived-month-summary">
                <span>{formatMonthLabel(monthKey)}</span>
                <span className="archived-month-count">{groups[monthKey].length} möten</span>
              </summary>

              <div className="archived-month-list">
                {groups[monthKey].map((m) => {
                  const mDate = new Date(m.scheduledAt)
                  const meetingColor = getMeetingColor(m.id)
                  return (
                    <details key={m.id} className="archived-meeting">
                      <summary className="archived-meeting-summary">
                        <div className="archived-meeting-summary-main">
                          <strong>{m.title}</strong>
                          <span className="archived-meeting-date">
                            {mDate.toLocaleString('sv-SE', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className="archived-meeting-summary-meta">
                          <span>{m.points.length} punkter</span>
                          <span className="archived-meeting-expand-hint">Fäll ut</span>
                          <span className="meeting-archived-badge">Arkiverad</span>
                        </div>
                      </summary>

                      <div
                        className="meeting-wrapper"
                        style={{
                          borderColor: meetingColor.primary,
                          borderLeftColor: meetingColor.primary,
                          borderLeftWidth: '4px',
                          background: `linear-gradient(to right, ${meetingColor.light}15 0%, transparent 4px)`
                        }}
                      >
                        <div
                          className="meeting-header-card"
                          style={{
                            borderColor: meetingColor.primary,
                            borderLeftColor: meetingColor.primary,
                            borderLeftWidth: '4px'
                          }}
                        >
                          <h2 className="meeting-title">{m.title}</h2>
                          <div className="meeting-meta">
                            <span className="meeting-date-display">
                              {mDate.toLocaleString('sv-SE', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {m.archivedAt && (
                              <span className="meeting-archived-badge">
                                Arkiverad: {new Date(m.archivedAt).toLocaleDateString('sv-SE', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="meeting-points-section">
                          <div className="meeting-points-header">
                            <h3>Agendapunkter för detta möte ({m.points.length})</h3>
                          </div>

                          {m.points.length === 0 ? (
                            <div className="no-points">
                              <p>Inga agendapunkter.</p>
                            </div>
                          ) : (
                            <div className="points-list">
                              {m.points.map((p) => (
                                <div
                                  key={p.id}
                                  className="point-item-card point-item-card--linked"
                                  style={{ borderLeftColor: meetingColor.primary }}
                                >
                                  <div
                                    className="point-meeting-indicator"
                                    style={{
                                      background: meetingColor.primary,
                                      boxShadow: `0 0 0 2px ${meetingColor.primary}`
                                    }}
                                  ></div>
                                  <div className="point-item-content">
                                    <div className="point-item-main">
                                      <div className="point-header-row">
                                        <label className="point-checkbox-label">
                                          <input
                                            type="checkbox"
                                            checked={p.completed}
                                            disabled={true}
                                            className="point-checkbox"
                                          />
                                          <h4 className={`point-title ${p.completed ? 'point-title--completed' : ''}`}>
                                            {p.title}
                                          </h4>
                                        </label>
                                      </div>
                                      {p.description && <p className="point-description">{p.description}</p>}
                                      {p.notes && (
                                        <div className="point-notes">
                                          <strong>Anteckningar/Beslut:</strong>
                                          <p>{p.notes}</p>
                                        </div>
                                      )}
                                      <div className="point-meta">
                                        <span>Förslag av: {p.author}</span>
                                        <span className="point-date">
                                          {new Date(p.createdAt).toLocaleDateString('sv-SE', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                          })}
                                        </span>
                                        {p.completed && p.completedAt && (
                                          <span className="point-completed-date">
                                            Klar: {new Date(p.completedAt).toLocaleDateString('sv-SE', {
                                              year: 'numeric',
                                              month: 'short',
                                              day: 'numeric'
                                            })}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </details>
          ))}
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
  const meetingColor = getMeetingColor(meeting.id)

  return (
    <div className="meeting-points-container">
      {meetings.length > 1 && (
        <div className="meetings-selector">
              <h3>Välj möte</h3>
              <div className="meetings-selector-hint">Agendapunkter för valt möte visas under.</div>
          <div className="meetings-list-selector">
            {meetings.map((m) => {
              const mDate = new Date(m.scheduledAt)
              const mColor = getMeetingColor(m.id)
              return (
                <button
                  key={m.id}
                  className={`meeting-selector-btn ${selectedMeetingId === m.id ? 'meeting-selector-btn--active' : ''}`}
                  onClick={() => handleMeetingSelect(m.id)}
                  style={{
                    borderLeftColor: mColor.primary,
                    borderLeftWidth: '4px',
                    ...(selectedMeetingId === m.id ? {
                      background: mColor.light,
                      borderColor: mColor.primary
                    } : {})
                  }}
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
      <div 
        className="meeting-wrapper"
        style={{
          borderColor: meetingColor.primary,
          borderLeftColor: meetingColor.primary,
          borderLeftWidth: '4px',
          background: `linear-gradient(to right, ${meetingColor.light}15 0%, transparent 4px)`
        }}
      >
        <div className="meeting-header-card">
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
            {isPast && !meeting.archived && <span className="meeting-past-badge">Mötet har redan ägt rum</span>}
            {meeting.archived && meeting.archivedAt && (
              <span className="meeting-archived-badge">
                Arkiverad: {new Date(meeting.archivedAt).toLocaleDateString('sv-SE', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            )}
          </div>
        </div>

        <div className="meeting-points-section">
        <div className="meeting-points-header">
          <h3>Agendapunkter för detta möte ({meeting.points.length})</h3>
          <div className="meeting-points-header-actions">
            {isPast && !meeting.archived && (
              <button
                className="meeting-archive-btn"
                onClick={handleArchiveMeeting}
                disabled={archiving}
              >
                {archiving ? 'Arkiverar...' : 'Arkivera möte'}
              </button>
            )}
            {!isPast && !meeting.archived && (
              <button
                className={`meeting-add-btn ${showForm ? 'meeting-add-btn--cancel' : ''}`}
                onClick={() => setShowForm(!showForm)}
              >
                {showForm ? 'Avbryt' : '+ Lägg till punkt'}
              </button>
            )}
          </div>
        </div>

      {showForm && !isPast && (
        <div 
          className="point-form-card"
          style={{
            borderLeftColor: meetingColor.primary,
            borderLeftWidth: '3px',
            background: `linear-gradient(to right, ${meetingColor.light}10 0%, transparent 3px)`
          }}
        >
          <div 
            className="point-form-badge"
            style={{
              background: meetingColor.primary
            }}
          >
            Lägg till punkt till detta möte
          </div>
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
            <div 
              key={point.id} 
              className="point-item-card point-item-card--linked"
              style={{
                borderLeftColor: meetingColor.primary
              }}
            >
              <div 
                className="point-meeting-indicator"
                style={{
                  background: meetingColor.primary,
                  boxShadow: `0 0 0 2px ${meetingColor.primary}`
                }}
              ></div>
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
                  <div className="input-group">
                    <label>Anteckningar/Beslut (valfritt)</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={3}
                      placeholder="T.ex. beslut som tagits, åtgärder att vidta..."
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
                    <div className="point-header-row">
                      <label className="point-checkbox-label">
                        <input
                          type="checkbox"
                          checked={point.completed}
                          onChange={() => handleToggleComplete(point.id, point.completed)}
                          disabled={meeting.archived || (isPast && !meeting.archived)}
                          className="point-checkbox"
                        />
                        <h4 className={`point-title ${point.completed ? 'point-title--completed' : ''}`}>
                          {point.title}
                        </h4>
                      </label>
                    </div>
                    {point.description && (
                      <p className="point-description">{point.description}</p>
                    )}
                    {point.notes && (
                      <div className="point-notes">
                        <strong>Anteckningar/Beslut:</strong>
                        <p>{point.notes}</p>
                      </div>
                    )}
                    {showNotesEditor === point.id ? (
                      <div className="point-notes-editor">
                        <textarea
                          value={notesText}
                          onChange={(e) => setNotesText(e.target.value)}
                          placeholder="Lägg till anteckningar eller beslut..."
                          rows={3}
                          className="meeting-textarea"
                        />
                        <div className="point-notes-actions">
                          <button
                            type="button"
                            className="meeting-submit-btn"
                            onClick={() => handleSaveNotes(point.id)}
                          >
                            Spara
                          </button>
                          <button
                            type="button"
                            className="point-cancel-btn"
                            onClick={() => {
                              setShowNotesEditor(null)
                              setNotesText('')
                            }}
                          >
                            Avbryt
                          </button>
                        </div>
                      </div>
                    ) : (
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
                        {point.completed && point.completedAt && (
                          <span className="point-completed-date">
                            Genomgången: {new Date(point.completedAt).toLocaleDateString('sv-SE', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {!meeting.archived && (
                    <div className="point-actions">
                      {showNotesEditor !== point.id && (
                        <button
                          className="point-notes-btn"
                          onClick={() => {
                            setShowNotesEditor(point.id)
                            setNotesText(point.notes || '')
                          }}
                          title="Lägg till anteckningar"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                          </svg>
                        </button>
                      )}
                      {!isPast && (
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
                      )}
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
    </div>
  )
}

