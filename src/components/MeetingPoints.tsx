import { useState, useEffect, useCallback } from 'react'

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
  const [meeting, setMeeting] = useState<Meeting | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pointTitle, setPointTitle] = useState('')
  const [pointDescription, setPointDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadMeeting = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/meetings/next')
      if (res.ok) {
        const data = await res.json()
        setMeeting(data)
      } else if (res.status === 404) {
        setMeeting(null)
      }
    } catch (error) {
      console.error('Error loading meeting:', error)
    } finally {
      setLoading(false)
    }
  }, [authenticatedFetch])

  useEffect(() => {
    loadMeeting()
  }, [loadMeeting])

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
        loadMeeting()
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

  const handleDeletePoint = async (pointId: number) => {
    if (!meeting) return
    if (!confirm('Är du säker på att du vill ta bort denna punkt?')) return

    try {
      const res = await authenticatedFetch(`/api/meetings/${meeting.id}/points/${pointId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        loadMeeting()
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

  if (!meeting) {
    return (
      <div className="meeting-points-container">
        <div className="no-meeting" style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#6b7280'
        }}>
          <h2>Inget kommande möte</h2>
          <p>Det finns inget planerat möte just nu.</p>
        </div>
      </div>
    )
  }

  const meetingDate = new Date(meeting.scheduledAt)
  const isPast = meetingDate < new Date()

  return (
    <div className="meeting-points-container">
      <div className="meeting-header" style={{
        background: 'white',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{meeting.title}</h2>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          fontSize: '0.875rem',
          color: '#6b7280'
        }}>
          <span>
            {meetingDate.toLocaleString('sv-SE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
          {isPast && <span style={{ color: '#dc2626', fontWeight: '500' }}>Mötet har redan ägt rum</span>}
        </div>
      </div>

      <div className="meeting-points-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0 }}>Agendapunkter ({meeting.points.length})</h3>
        {!isPast && (
          <button
            onClick={() => setShowForm(!showForm)}
            style={{
              padding: '0.5rem 1rem',
              background: showForm ? '#6b7280' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500'
            }}
          >
            {showForm ? 'Avbryt' : '+ Lägg till punkt'}
          </button>
        )}
      </div>

      {showForm && !isPast && (
        <div className="point-form" style={{
          background: 'white',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{ marginTop: 0 }}>Ny agendapunkt</h4>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Ditt namn *
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Titel *
              </label>
              <input
                type="text"
                value={pointTitle}
                onChange={(e) => setPointTitle(e.target.value)}
                required
                placeholder="Ex: Uppdatering av projekt X"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Beskrivning (valfritt)
              </label>
              <textarea
                value={pointDescription}
                onChange={(e) => setPointDescription(e.target.value)}
                rows={4}
                placeholder="Beskriv vad du vill diskutera..."
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.5rem 1rem',
                background: submitting ? '#9ca3af' : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              {submitting ? 'Lägger till...' : 'Lägg till'}
            </button>
          </form>
        </div>
      )}

      {meeting.points.length === 0 ? (
        <div className="no-points" style={{
          textAlign: 'center',
          padding: '2rem',
          color: '#6b7280',
          background: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <p>Inga agendapunkter har lagts till ännu.</p>
        </div>
      ) : (
        <div className="points-list">
          {meeting.points.map((point) => (
            <div
              key={point.id}
              className="point-item"
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                border: '1px solid #e5e7eb'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{point.title}</h4>
                  {point.description && (
                    <p style={{ margin: '0 0 0.5rem 0', color: '#6b7280', fontSize: '0.875rem' }}>
                      {point.description}
                    </p>
                  )}
                  <div style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                    <span>Förslag av: {point.author}</span>
                    <span style={{ marginLeft: '1rem' }}>
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
                  <button
                    onClick={() => handleDeletePoint(point.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      marginLeft: '1rem'
                    }}
                    title="Ta bort"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

