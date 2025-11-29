import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import LogForm from './components/LogForm'
import LogList from './components/LogList'
import ChangelogModal from './components/ChangelogModal'

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

export interface LogMessage {
  id: number
  message: string
  author: string
  version: string
  pinned: boolean
  createdAt: string
  signatures: ReadSignature[]
  comments: Comment[]
}

export default function App() {
  const [logs, setLogs] = useState<LogMessage[]>([])
  const [version, setVersion] = useState('')
  const [loading, setLoading] = useState(true)
  const [showChangelog, setShowChangelog] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs')
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
  }, [])

  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(console.error)

    fetchLogs()
  }, [fetchLogs])

  const handleNewLog = (log: LogMessage) => {
    setLogs(prev => [log, ...prev])
    setShowForm(false)
  }

  const handleSign = (logId: number, signature: ReadSignature) => {
    setLogs(prev => prev.map(log => 
      log.id === logId 
        ? { ...log, signatures: [...log.signatures, signature] }
        : log
    ))
  }

  const handlePin = async (logId: number) => {
    try {
      const res = await fetch(`/api/logs/${logId}/pin`, { method: 'POST' })
      if (res.ok) {
        const updated = await res.json()
        setLogs(prev => prev.map(log => log.id === logId ? updated : log))
      }
    } catch (error) {
      console.error('Failed to toggle pin:', error)
    }
  }

  const handleComment = (logId: number, comment: Comment, parentId?: number) => {
    setLogs(prev => prev.map(log => {
      if (log.id !== logId) return log
      
      if (parentId) {
        // Add reply to existing comment
        return {
          ...log,
          comments: log.comments.map(c => 
            c.id === parentId 
              ? { ...c, replies: [...c.replies, comment] }
              : c
          )
        }
      } else {
        // Add new top-level comment
        return { ...log, comments: [...log.comments, { ...comment, replies: [] }] }
      }
    }))
  }

  const handleEditLog = async (logId: number, message: string) => {
    try {
      const res = await fetch(`/api/logs/${logId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
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
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      if (res.ok) {
        const updated = await res.json()
        setLogs(prev => prev.map(log => {
          if (log.id !== logId) return log
          if (parentId) {
            return {
              ...log,
              comments: log.comments.map(c => 
                c.id === parentId 
                  ? { ...c, replies: c.replies.map(r => r.id === commentId ? updated : r) }
                  : c
              )
            }
          } else {
            return {
              ...log,
              comments: log.comments.map(c => c.id === commentId ? { ...updated, replies: c.replies } : c)
            }
          }
        }))
      }
    } catch (error) {
      console.error('Failed to delete comment:', error)
    }
  }

  // Sort: pinned first, then by date
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return (
    <>
      <Header 
        version={version} 
        onVersionClick={() => setShowChangelog(true)} 
      />
      <main className="main">
        <div className="create-trigger">
          <div className="create-avatar">?</div>
          <button className="create-btn" onClick={() => setShowForm(true)}>
            Vad vill du dela?
          </button>
        </div>
        <LogList 
          logs={sortedLogs} 
          loading={loading} 
          onSign={handleSign} 
          onPin={handlePin}
          onComment={handleComment}
          onEditLog={handleEditLog}
          onDeleteComment={handleDeleteComment}
        />
      </main>
      {showForm && (
        <LogForm onSuccess={handleNewLog} onClose={() => setShowForm(false)} />
      )}
      {showChangelog && (
        <ChangelogModal onClose={() => setShowChangelog(false)} />
      )}
    </>
  )
}
