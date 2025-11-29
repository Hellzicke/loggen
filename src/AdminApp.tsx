import { useState, useEffect } from 'react'
import AdminLogin from './components/AdminLogin'
import AdminPanel from './components/AdminPanel'

export default function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    const storedUsername = localStorage.getItem('adminUsername')
    if (token && storedUsername) {
      setIsAuthenticated(true)
      setUsername(storedUsername)
    }
  }, [])

  const handleLogin = (token: string, username: string) => {
    setIsAuthenticated(true)
    setUsername(username)
  }

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={handleLogin} />
  }

  return <AdminPanel />
}

