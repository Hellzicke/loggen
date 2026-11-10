import { useState, useEffect } from 'react'
import AdminLogin from './components/AdminLogin'
import AdminPanel from './components/AdminPanel'
import { clearAdminTokens } from './adminAuth'

export default function AdminApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    const storedUsername = localStorage.getItem('adminUsername')
    if (token && storedUsername) {
      setIsAuthenticated(true)
    }
  }, [])

  // Inloggningen gick inte att förnya – visa inloggningssidan igen
  useEffect(() => {
    const onExpired = () => {
      clearAdminTokens()
      setIsAuthenticated(false)
    }
    window.addEventListener('admin-auth-expired', onExpired)
    return () => window.removeEventListener('admin-auth-expired', onExpired)
  }, [])

  const handleLogin = () => {
    setIsAuthenticated(true)
  }

  if (!isAuthenticated) {
    return <AdminLogin onSuccess={handleLogin} />
  }

  return <AdminPanel />
}

