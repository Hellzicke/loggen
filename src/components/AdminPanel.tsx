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

export default function AdminPanel() {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [images, setImages] = useState<Image[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'images'>('overview')
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<number | null>(null)

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
                        className="delete-btn admin-delete-image-btn"
                        onClick={() => handleDeleteImage(img.filename)}
                        title="Ta bort bild permanent"
                        type="button"
                      >
                        Ta bort
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

