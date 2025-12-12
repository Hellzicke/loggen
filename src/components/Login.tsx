import { useState, FormEvent } from 'react'

interface LoginProps {
  onSuccess: (token: string) => void
}

export default function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        const data = await res.json()
        localStorage.setItem('authToken', data.token)
        onSuccess(data.token)
      } else {
        const data = await res.json()
        setError(data.error || 'Fel lösenord')
      }
    } catch (error) {
      setError('Ett fel uppstod vid inloggning')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login">
      <div className="login-card">
        <h2>Inloggning krävs</h2>
        <p className="login-description">Ange lösenord för att komma åt sidan</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Lösenord</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="Ange lösenord"
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  )
}

