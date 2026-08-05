import { useState, FormEvent } from 'react'

interface AdminLoginModalProps {
  onSuccess: (token: string, username: string) => void
  onClose: () => void
}

// Admin-inloggning direkt i huvudappen. Går via centrala Auth (samma som
// Fish/Schema/öppettider) — servern släpper bara in konton med åtkomst till
// 'personalloggen' eller superadmin.
export default function AdminLoginModal({ onSuccess, onClose }: AdminLoginModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('adminToken', data.token)
        localStorage.setItem('adminUsername', data.username)
        onSuccess(data.token, data.username)
      } else {
        setError(data.error || 'Inloggning misslyckades')
      }
    } catch {
      setError('Ett fel uppstod vid inloggning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="meeting-form-overlay" onClick={onClose}>
      <div className="meeting-form-modal" onClick={e => e.stopPropagation()}>
        <h3>Logga in som admin</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>E-post</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              className="admin-meeting-input"
            />
          </div>
          <div className="input-group">
            <label>Lösenord</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="admin-meeting-input"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <div className="admin-meeting-form-actions">
            <button type="button" className="admin-meeting-cancel-btn" onClick={onClose}>
              Avbryt
            </button>
            <button type="submit" className="admin-meeting-save-btn" disabled={loading}>
              {loading ? 'Loggar in...' : 'Logga in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
