import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import LogForm from './components/LogForm'
import LogList from './components/LogList'
import ChangelogModal from './components/ChangelogModal'
import ArchiveModal from './components/ArchiveModal'
import UnpinModal from './components/UnpinModal'
import ConfirmModal from './components/ConfirmModal'
import Login from './components/Login'
import MeetingPoints from './components/MeetingPoints'

export interface ReadSignature {
  id: number
  name: string
  logId: number
  createdAt: string
}

export interface Comment {
  id: number
  message: string
  author: string
  deleted: boolean
  logId: number
  parentId: number | null
  createdAt: string
  replies: Comment[]
}

export interface Reaction {
  id: number
  emoji: string
  logId: number
  createdAt: string
}

export interface LogMessage {
  id: number
  title: string
  message: string
  author: string
  version: string
  pinned: boolean
  archived: boolean
  archivedAt: string | null
  unpinnedAt: string | null
  imageUrl: string | null
  createdAt: string
  signatures: ReadSignature[]
  comments: Comment[]
  reactions: Reaction[]
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [archivedLogs, setArchivedLogs] = useState<LogMessage[]>([])
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [unpinPrompt, setUnpinPrompt] = useState<LogMessage | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [greetingPositions, setGreetingPositions] = useState<Array<{top: number, left: number}>>([])
  const [activeView, setActiveView] = useState<'logg' | 'förslagslåda' | 'mötespunkter'>('logg')
  const [showArchivedMeetings, setShowArchivedMeetings] = useState(false)

  // Check if it's Christmas (24-26 December)
  const isChristmas = () => {
    const now = new Date()
    const month = now.getMonth() // 0-11, December is 11
    const day = now.getDate()
    return month === 11 && (day === 24 || day === 25 || day === 26)
  }

  const [showChristmasTheme, setShowChristmasTheme] = useState(isChristmas())

  useEffect(() => {
    // Check daily if it's Christmas
    const checkChristmas = () => {
      setShowChristmasTheme(isChristmas())
    }
    
    checkChristmas()
    const interval = setInterval(checkChristmas, 60 * 60 * 1000) // Check every hour
    
    return () => clearInterval(interval)
  }, [])

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (token) {
      setAuthToken(token)
      setIsAuthenticated(true)
    }
  }, [])

  // Generate random positions for greetings (only if Christmas theme is active)
  useEffect(() => {
    if (!showChristmasTheme) return

    const generateRandomPositions = () => {
      return Array.from({ length: 11 }, () => ({
        top: Math.random() * 80 + 5, // 5% to 85%
        left: Math.random() * 90 + 5  // 5% to 95%
      }))
    }
    
    setGreetingPositions(generateRandomPositions())
    
    // Change positions every 20 seconds (after fade out completes at 8s)
    const interval = setInterval(() => {
      // Wait for fade out to complete (8 seconds = 40% of 20s animation)
      setTimeout(() => {
        setGreetingPositions(generateRandomPositions())
      }, 8000)
    }, 20000)
    
    return () => clearInterval(interval)
  }, [showChristmasTheme])

  // Helper function to make authenticated fetch requests (memoized)
  const authenticatedFetch = useCallback(async (url: string, options: RequestInit = {}) => {
    const token = authToken || localStorage.getItem('authToken')
    const headers: HeadersInit = {
      ...(options.headers as HeadersInit),
      'Authorization': `Bearer ${token}`,
    }
    
    // Only add Content-Type if it's not FormData (browser will set it for FormData)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (response.status === 401 || response.status === 403) {
      // Token expired or invalid, clear and show login
      localStorage.removeItem('authToken')
      setIsAuthenticated(false)
      setAuthToken(null)
      throw new Error('Authentication required')
    }

    return response
  }, [authToken])

  const fetchLogs = useCallback(async () => {
    if (!isAuthenticated) return
    
    try {
      const res = await authenticatedFetch('/api/logs')
      const data = await res.json()
      if (Array.isArray(data)) {
        setLogs(data)
      } else {
        console.error('API error:', data)
        setLogs([])
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated, authenticatedFetch])

  const fetchArchivedLogs = useCallback(async () => {
    if (!isAuthenticated) return
    
    try {
      const res = await authenticatedFetch('/api/logs/archived')
      const data = await res.json()
      if (Array.isArray(data)) {
        setArchivedLogs(data)
      }
    } catch (error) {
      console.error('Failed to fetch archived logs:', error)
    }
  }, [isAuthenticated, authenticatedFetch])

  useEffect(() => {
    if (!isAuthenticated) return

    fetch('/api/version')
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(console.error)

    fetchLogs()
  }, [fetchLogs, isAuthenticated])

  useEffect(() => {
    if (showArchive) {
      fetchArchivedLogs()
    }
  }, [showArchive, fetchArchivedLogs])

  const handleNewLog = useCallback((log: LogMessage) => {
    setLogs(prev => [log, ...prev])
    setShowForm(false)
  }, [])

  const handleCloseForm = useCallback(() => {
    setShowForm(false)
  }, [])

  const handleSign = (logId: number, signature: ReadSignature) => {
    setLogs(prev => prev.map(log => 
      log.id === logId 
        ? { ...log, signatures: [...log.signatures, signature] }
        : log
    ))
  }

  const handlePin = async (logId: number) => {
    const log = logs.find(l => l.id === logId)
    if (!log) return

    // If unpinning, check if it's an old post
    if (log.pinned) {
      const daysSinceCreated = (Date.now() - new Date(log.createdAt).getTime()) / (24 * 60 * 60 * 1000)
      if (daysSinceCreated >= 30) {
        setUnpinPrompt(log)
        return
      }
    }

    await togglePin(logId)
  }

  const togglePin = async (logId: number) => {
    try {
      const res = await authenticatedFetch(`/api/logs/${logId}/pin`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setLogs(prev => prev.map(log => log.id === logId ? updated : log))
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  const handleUnpinAndArchive = async (logId: number) => {
    try {
      // First unpin
      await authenticatedFetch(`/api/logs/${logId}/pin`, { method: 'POST' })
      // Then archive
      const res = await authenticatedFetch(`/api/logs/${logId}/archive`, { method: 'POST' })
      if (res.ok) {
        setLogs(prev => prev.filter(log => log.id !== logId))
      }
    } catch (error) {
      console.error('Failed to archive:', error)
    }
    setUnpinPrompt(null)
  }

  const handleUnpinKeep = async (logId: number) => {
    await togglePin(logId)
    setUnpinPrompt(null)
  }

  const handleArchive = async (logId: number) => {
    try {
      const res = await authenticatedFetch(`/api/logs/${logId}/archive`, { method: 'POST' })
      if (res.ok) {
        setLogs(prev => prev.filter(log => log.id !== logId))
      }
    } catch (error) {
      console.error('Failed to archive:', error)
    }
  }

  const handleUnarchive = async (logId: number) => {
    try {
      const res = await authenticatedFetch(`/api/logs/${logId}/unarchive`, { method: 'POST' })
      if (res.ok) {
        const restored = await res.json()
        setArchivedLogs(prev => prev.filter(log => log.id !== logId))
        setLogs(prev => [restored, ...prev])
      }
    } catch (error) {
      console.error('Failed to unarchive:', error)
    }
  }

  const handleComment = (logId: number, comment: Comment, parentId?: number) => {
    setLogs(prev => prev.map(log => {
      if (log.id !== logId) return log
      
      if (parentId) {
        return {
          ...log,
          comments: log.comments.map(c => 
            c.id === parentId 
              ? { ...c, replies: [...c.replies, comment] }
              : c
          )
        }
      } else {
        return { ...log, comments: [...log.comments, { ...comment, replies: [] }] }
      }
    }))
  }

  const handleEditLog = async (logId: number, title: string, message: string, imageUrl: string | null) => {
    try {
      const res = await authenticatedFetch(`/api/logs/${logId}`, {
        method: 'PUT',
        body: JSON.stringify({ title, message, imageUrl })
      })
      if (res.ok) {
        const updated = await res.json()
        setLogs(prev => prev.map(log => log.id === logId ? updated : log))
      }
    } catch (error) {
      console.error('Failed to edit log:', error)
    }
  }

  const handleDeleteComment = async (logId: number, commentId: number, parentId?: number) => {
    try {
      const res = await authenticatedFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        setLogs(prev => prev.map(log => {
          if (log.id !== logId) return log
          if (parentId) {
            return {
              ...log,
              comments: log.comments.map(c => 
                c.id === parentId 
                  ? { ...c, replies: c.replies.filter(r => r.id !== commentId) }
                  : c
              )
            }
          } else {
            return {
              ...log,
              comments: log.comments.filter(c => c.id !== commentId)
            }
          }
        }))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  const handleReaction = async (logId: number, emoji: string) => {
    try {
      const res = await authenticatedFetch(`/api/logs/${logId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji })
      })
      if (res.ok) {
        const reaction = await res.json()
        setLogs(prev => prev.map(log => {
          if (log.id !== logId) return log
          return { ...log, reactions: [...log.reactions, reaction] }
        }))
      }
    } catch (error) {
      console.error('Failed to add reaction:', error)
    }
  }

  const handleDeleteLog = (logId: number) => {
    setDeleteConfirm(logId)
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      const res = await authenticatedFetch(`/api/logs/${deleteConfirm}`, { method: 'DELETE' })
      if (res.ok) {
        setLogs(prev => prev.filter(log => log.id !== deleteConfirm))
      }
    } catch (error) {
      console.error('Failed to delete log:', error)
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleLoginSuccess = (token: string) => {
    setAuthToken(token)
    setIsAuthenticated(true)
    setLoading(true)
  }

  // Show login if not authenticated
  if (!isAuthenticated) {
    return <Login onSuccess={handleLoginSuccess} />
  }

  return (
    <>
      <div className={`header-hover-area ${showChristmasTheme ? 'christmas-active' : ''}`}></div>
      {showChristmasTheme && (
        <div className="christmas-greetings">
          {greetingPositions.map((pos, index) => {
            const greetings = [
              'GOD JUL',
              'MERRY CHRISTMAS',
              'FROHE WEIHNACHTEN',
              'JOYEUX NOËL',
              'FELIZ NAVIDAD',
              'BUON NATALE',
              'GLÆDELIG JUL',
              'VESELÉ VÁNOCE',
              'HYVÄÄ JOULUA',
              'عيد ميلاد مجيد',
              'کریسمس مبارک'
            ]
            return (
              <span 
                key={index}
                className="greeting-text"
                style={{
                  top: `${pos.top}%`,
                  left: `${pos.left}%`,
                  animationDelay: `${index * 0.5}s`
                }}
              >
                {greetings[index]}
              </span>
            )
          })}
        </div>
      )}
      <div className={showChristmasTheme ? 'christmas-theme' : ''}>
      <Header 
        version={version} 
        onVersionClick={() => setShowChangelog(true)}
        onArchiveClick={() => setShowArchive(true)}
        archiveCount={archivedLogs.length}
        activeView={activeView}
        onViewChange={setActiveView}
        onArchivedMeetingsClick={() => {
          // Ensure the toggle has visible effect even if user is not currently on "mötespunkter"
          setActiveView('mötespunkter')
          setShowArchivedMeetings(prev => !prev)
        }}
        showArchivedMeetings={showArchivedMeetings}
      />
      <main className="main">
        {activeView === 'logg' && (
          <>
            <div className="create-trigger">
              <div className="create-avatar">?</div>
              <button className="create-btn" onClick={() => setShowForm(true)}>
                Vad vill du dela?
              </button>
            </div>
            <LogList 
              logs={[...logs].sort((a, b) => {
                if (a.pinned && !b.pinned) return -1
                if (!a.pinned && b.pinned) return 1
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              })} 
              loading={loading} 
              onSign={handleSign} 
              onPin={handlePin}
              onComment={handleComment}
              onEditLog={handleEditLog}
              onDeleteComment={handleDeleteComment}
              onReaction={handleReaction}
              onDeleteLog={handleDeleteLog}
            />
          </>
        )}
        {activeView === 'förslagslåda' && (
          <div className="coming-soon">
            <h2>Förslagslåda</h2>
            <p>Denna funktion kommer snart...</p>
          </div>
        )}
        {activeView === 'mötespunkter' && (
          <MeetingPoints authenticatedFetch={authenticatedFetch} showArchived={showArchivedMeetings} />
        )}
      </main>
      {showForm && (
        <LogForm 
          onSuccess={handleNewLog} 
          onClose={handleCloseForm} 
        />
      )}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
      {showArchive && (
        <ArchiveModal 
          logs={archivedLogs}
          onClose={() => setShowArchive(false)}
          onUnarchive={handleUnarchive}
        />
      )}
      {unpinPrompt && (
        <UnpinModal
          log={unpinPrompt}
          onArchive={() => handleUnpinAndArchive(unpinPrompt.id)}
          onKeep={() => handleUnpinKeep(unpinPrompt.id)}
          onCancel={() => setUnpinPrompt(null)}
        />
      )}
      {deleteConfirm && (
        <ConfirmModal
          title="Ta bort inlägg"
          message="Är du säker på att du vill ta bort detta inlägg? Detta går inte att ångra."
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      </div>
    </>
  )
}
