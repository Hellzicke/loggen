import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Check if we're on admin route
const isAdminRoute = window.location.pathname.startsWith('/admin')

if (isAdminRoute) {
  import('./AdminApp.tsx').then(({ default: AdminApp }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AdminApp />
      </StrictMode>,
    )
  })
} else {
  import('./App.tsx').then(({ default: App }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  })
}
