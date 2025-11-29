import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import LogForm from './components/LogForm'
import LogList from './components/LogList'
import ChangelogModal from './components/ChangelogModal'

interface LogMessage {
  id: number
  message: string
  author: string
  version: string
  createdAt: string
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

  return (
    <>
      <Header 
        version={version} 
        onVersionClick={() => setShowChangelog(true)} 
      />
      <main className="main">
        <button className="create-btn" onClick={() => setShowForm(true)}>
          Skapa inlägg
        </button>
        <LogList logs={logs} loading={loading} />
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
