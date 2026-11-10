// Admin-inloggning via centrala Auth: åtkomsttoken gäller 15 min, förnyelsetoken 7 dagar.
// Anrop med utgången token förnyas automatiskt och görs om.

export function clearAdminTokens() {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminRefreshToken')
  localStorage.removeItem('adminUsername')
}

// Hämta ny åtkomsttoken med sparad förnyelsetoken. Returnerar ny token eller null.
export async function refreshAdminToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('adminRefreshToken')
  if (!refreshToken) return null
  try {
    const res = await fetch('/api/admin/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.accessToken) return null
    localStorage.setItem('adminToken', data.accessToken)
    if (data.refreshToken) localStorage.setItem('adminRefreshToken', data.refreshToken)
    return data.accessToken
  } catch {
    return null
  }
}

// fetch med aktuell admin-token; vid 401/403 förnyas token och anropet görs om en gång.
export async function adminRequest(url: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) => {
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return fetch(url, { ...init, headers })
  }
  let response = await send(localStorage.getItem('adminToken'))
  if (response.status === 401 || response.status === 403) {
    const fresh = await refreshAdminToken()
    if (fresh) response = await send(fresh)
  }
  if (response.status === 401 || response.status === 403) {
    // Gick inte att förnya – låt appen visa inloggningen
    window.dispatchEvent(new Event('admin-auth-expired'))
  }
  return response
}
