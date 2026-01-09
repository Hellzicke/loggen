import { useState, useEffect } from 'react'

interface Overview {
  logs: {
    total: number
    pinned: number
    archived: number
    active: number
  }
  comments: number
  signatures: number
  reactions: number
  images: number
}

interface LogMessage {
  id: number
  title: string
  author: string
  createdAt: string
  pinned: boolean
  archived: boolean
  imageUrl: string | null
}

interface Image {
  filename: string
  url: string
  size: number
  uploadedAt: string
}

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

export default function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [images, setImages] = useState<Image[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'images' | 'meetings'>('overview')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [showMeetingForm, setShowMeetingForm] = useState(false)
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null)
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingDate, setMeetingDate] = useState('')

  const getAuthToken = () => localStorage.getItem('adminToken')

  const fetchData = async () => {
    const token = getAuthToken()
    if (!token) {
      window.location.href = '/admin'
      return
    }

    try {
      const headers = { 'Authorization': `Bearer ${token}` }
      
      if (activeTab === 'overview') {
        const res = await fetch('/api/admin/overview', { headers })
        if (res.ok) {
          const data = await res.json()
          setOverview(data)
        }
      } else if (activeTab === 'logs') {
        const res = await fetch('/api/admin/logs', { headers })
        if (res.ok) {
          const data = await res.json()
          setLogs(data)
        }
      } else if (activeTab === 'images') {
        const res = await fetch('/api/admin/images', { headers })
        if (res.ok) {
          const data = await res.json()
          setImages(data)
        }
      } else if (activeTab === 'meetings') {
        const res = await fetch('/api/admin/meetings', { headers })
        if (res.ok) {
          const data = await res.json()
          setMeetings(data)
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [activeTab])

  // Load images count on mount
  useEffect(() => {
    const loadImagesCount = async () => {
      const token = getAuthToken()
      if (!token) return

      try {
        const res = await fetch('/api/admin/images', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (res.ok) {
          const data = await res.json()
          setImages(data)
        }
      } catch (error) {
        console.error('Error loading images:', error)
      }
    }

    loadImagesCount()
  }, [])

  const handleDeleteLog = async (logId: number) => {
    if (!confirm('Är du säker på att du vill ta bort detta inlägg?')) return

    setDeleting(logId)
    const token = getAuthToken()
    try {
      const res = await fetch(`/api/admin/logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setLogs(prev => prev.filter(log => log.id !== logId))
      }
    } catch (error) {
      console.error('Error deleting log:', error)
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteImage = async (filename: string) => {
    if (!confirm('Är du säker på att du vill ta bort denna bild permanent?')) return

    const token = getAuthToken()
    try {
      const res = await fetch(`/api/admin/images/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setImages(prev => prev.filter(img => img.filename !== filename))
      } else {
        const data = await res.json()
        alert(data.error || 'Kunde inte ta bort bilden')
      }
    } catch (error) {
      console.error('Error deleting image:', error)
      alert('Ett fel uppstod vid borttagning av bilden')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUsername')
    window.location.href = '/admin'
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleCreateMeeting = () => {
    setEditingMeeting(null)
    setMeetingTitle('')
    setMeetingDate('')
    setShowMeetingForm(true)
  }

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeeting(meeting)
    setMeetingTitle(meeting.title)
    setMeetingDate(new Date(meeting.scheduledAt).toISOString().slice(0, 16))
    setShowMeetingForm(true)
  }

  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    const token = getAuthToken()
    if (!token) return

    try {
      const url = editingMeeting 
        ? `/api/admin/meetings/${editingMeeting.id}`
        : '/api/admin/meetings'
      const method = editingMeeting ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: meetingTitle,
          scheduledAt: meetingDate
        })
      })

      if (res.ok) {
        setShowMeetingForm(false)
        fetchData()
      } else {
        const data = await res.json()
        alert(data.error || 'Kunde inte spara mötet')
      }
    } catch (error) {
      console.error('Error saving meeting:', error)
      alert('Ett fel uppstod vid sparande av mötet')
    }
  }

  const handleDeleteMeeting = async (meetingId: number) => {
    if (!confirm('Är du säker på att du vill ta bort detta möte?')) return

    const token = getAuthToken()
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setMeetings(prev => prev.filter(m => m.id !== meetingId))
      }
    } catch (error) {
      console.error('Error deleting meeting:', error)
    }
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Admin-panel</h1>
        <button className="logout-btn" onClick={handleLogout}>Logga ut</button>
      </div>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'overview' ? 'active' : ''} 
          onClick={() => setActiveTab('overview')}
        >
          Översikt
        </button>
        <button 
          className={activeTab === 'logs' ? 'active' : ''} 
          onClick={() => setActiveTab('logs')}
        >
          Inlägg ({logs.length})
        </button>
        <button 
          className={activeTab === 'images' ? 'active' : ''} 
          onClick={() => setActiveTab('images')}
        >
          Bilder ({images.length})
        </button>
        <button 
          className={activeTab === 'meetings' ? 'active' : ''} 
          onClick={() => setActiveTab('meetings')}
        >
          Möten ({meetings.length})
        </button>
      </div>

      <div className="admin-content">
        {loading ? (
          <div className="loading">Laddar...</div>
        ) : activeTab === 'overview' && overview ? (
          <div className="overview-grid">
            <div className="stat-card">
              <h3>Inlägg</h3>
              <div className="stat-value">{overview.logs.total}</div>
              <div className="stat-details">
                <span>Nålade: {overview.logs.pinned}</span>
                <span>Aktiva: {overview.logs.active}</span>
                <span>Arkiverade: {overview.logs.archived}</span>
              </div>
            </div>
            <div className="stat-card">
              <h3>Kommentarer</h3>
              <div className="stat-value">{overview.comments}</div>
            </div>
            <div className="stat-card">
              <h3>Signaturer</h3>
              <div className="stat-value">{overview.signatures}</div>
            </div>
            <div className="stat-card">
              <h3>Reaktioner</h3>
              <div className="stat-value">{overview.reactions}</div>
            </div>
            <div className="stat-card">
              <h3>Bilder</h3>
              <div className="stat-value">{overview.images}</div>
            </div>
          </div>
        ) : activeTab === 'logs' ? (
          <div className="admin-logs">
            {logs.map(log => (
              <div key={log.id} className="admin-log-item">
                <div className="log-info">
                  <h4>{log.title || '(Ingen rubrik)'}</h4>
                  <div className="log-meta">
                    <span>{log.author}</span>
                    <span>{new Date(log.createdAt).toLocaleDateString('sv-SE')}</span>
                    {log.pinned && <span className="badge">Nålad</span>}
                    {log.archived && <span className="badge">Arkiverad</span>}
                    {log.imageUrl && <span className="badge">Bild</span>}
                  </div>
                </div>
                <div className="log-actions">
                  <button 
                    className="delete-btn"
                    onClick={() => handleDeleteLog(log.id)}
                    disabled={deleting === log.id}
                  >
                    {deleting === log.id ? 'Tar bort...' : 'Ta bort'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'images' ? (
          <div className="admin-images">
            {images.length === 0 ? (
              <div className="empty-state">Inga bilder hittades</div>
            ) : (
              <div className="images-grid">
                {images.map(img => (
                  <div key={img.filename} className="admin-image-item">
                    <div className="admin-image-wrapper">
                      <img src={img.url} alt={img.filename} />
                    </div>
                    <div className="image-info">
                      <div className="image-name" title={img.filename}>{img.filename}</div>
                      <div className="image-meta">
                        <span>{formatBytes(img.size)}</span>
                        <span>{new Date(img.uploadedAt).toLocaleDateString('sv-SE')}</span>
                      </div>
                    </div>
                    <div className="image-actions">
                      <button 
                        className="admin-delete-image-btn"
                        onClick={() => handleDeleteImage(img.filename)}
                        title="Ta bort bild permanent"
                        type="button"
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          fontSize: '0.8125rem',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontWeight: '500',
                          display: 'block',
                          marginTop: '0.25rem'
                        }}
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'meetings' ? (
          <div className="admin-meetings">
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Möten</h2>
              <button 
                className="create-btn"
                onClick={handleCreateMeeting}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                Skapa nytt möte
              </button>
            </div>

            {showMeetingForm && (
              <div className="meeting-form-overlay" style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000
              }}>
                <div className="meeting-form" style={{
                  background: 'white',
                  padding: '2rem',
                  borderRadius: '8px',
                  maxWidth: '500px',
                  width: '90%'
                }}>
                  <h3 style={{ marginTop: 0 }}>{editingMeeting ? 'Redigera möte' : 'Skapa nytt möte'}</h3>
                  <form onSubmit={handleSaveMeeting}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Titel
                      </label>
                      <input
                        type="text"
                        value={meetingTitle}
                        onChange={(e) => setMeetingTitle(e.target.value)}
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
                        Datum och tid
                      </label>
                      <input
                        type="datetime-local"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
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
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        onClick={() => setShowMeetingForm(false)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#6b7280',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem'
                        }}
                      >
                        Avbryt
                      </button>
                      <button
                        type="submit"
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}
                      >
                        Spara
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {meetings.length === 0 ? (
              <div className="empty-state">Inga möten hittades</div>
            ) : (
              <div className="meetings-list">
                {meetings.map(meeting => (
                  <div key={meeting.id} className="admin-meeting-item" style={{
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <div className="meeting-info">
                      <h4 style={{ marginTop: 0, marginBottom: '0.5rem' }}>{meeting.title}</h4>
                      <div className="meeting-meta" style={{
                        display: 'flex',
                        gap: '1rem',
                        marginBottom: '0.5rem',
                        fontSize: '0.875rem',
                        color: '#6b7280'
                      }}>
                        <span>
                          {new Date(meeting.scheduledAt).toLocaleString('sv-SE', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        <span>{meeting.points.length} punkter</span>
                      </div>
                    </div>
                    <div className="meeting-actions" style={{
                      display: 'flex',
                      gap: '0.5rem',
                      marginTop: '0.5rem'
                    }}>
                      <button
                        className="edit-btn"
                        onClick={() => handleEditMeeting(meeting)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem'
                        }}
                      >
                        Redigera
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        disabled={deleting === meeting.id}
                        style={{
                          padding: '0.375rem 0.75rem',
                          background: '#dc2626',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem'
                        }}
                      >
                        {deleting === meeting.id ? 'Tar bort...' : 'Ta bort'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

