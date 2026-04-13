import { useEffect, useRef, useState } from 'react'

interface HeaderProps {
  version: string
  onVersionClick: () => void
  onArchiveClick: () => void
  archiveCount: number
  activeView: 'logg' | 'förslagslåda' | 'mötespunkter'
  onViewChange: (view: 'logg' | 'förslagslåda' | 'mötespunkter') => void
  onArchivedMeetingsClick?: () => void
  showArchivedMeetings?: boolean
}

type MenuKey = 'logg' | 'mötespunkter' | null

export default function Header({ version, onVersionClick, onArchiveClick, archiveCount, activeView, onViewChange, onArchivedMeetingsClick, showArchivedMeetings }: HeaderProps) {
  const [openMenu, setOpenMenu] = useState<MenuKey>(null)
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!openMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [openMenu])

  const handleGoTo = (view: 'logg' | 'förslagslåda' | 'mötespunkter') => {
    onViewChange(view)
    setOpenMenu(null)
    if (view === 'mötespunkter' && showArchivedMeetings && onArchivedMeetingsClick) {
      onArchivedMeetingsClick()
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1>Loggen</h1>
        <nav className="main-nav" ref={navRef}>
          <div className={`nav-item-wrapper ${openMenu === 'logg' ? 'nav-item-wrapper--open' : ''}`}>
            <button
              className={`nav-item ${activeView === 'logg' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'logg' ? null : 'logg')}
              aria-expanded={openMenu === 'logg'}
              aria-haspopup="true"
            >
              Logg
              <svg className={`nav-arrow ${openMenu === 'logg' ? 'nav-arrow--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {openMenu === 'logg' && (
              <div className="nav-dropdown" role="menu">
                <button
                  className={`nav-dropdown-item ${activeView === 'logg' ? 'nav-dropdown-item--current' : ''}`}
                  onClick={() => handleGoTo('logg')}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                  </svg>
                  <span>Aktuella inlägg</span>
                </button>
                <button
                  className="nav-dropdown-item"
                  onClick={() => { onArchiveClick(); setOpenMenu(null) }}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  <span>Arkiv</span>
                  {archiveCount > 0 && <span className="archive-count">{archiveCount}</span>}
                </button>
              </div>
            )}
          </div>

          <button
            className={`nav-item ${activeView === 'förslagslåda' ? 'active' : ''}`}
            onClick={() => { onViewChange('förslagslåda'); setOpenMenu(null) }}
          >
            Förslagslåda
          </button>

          <div className={`nav-item-wrapper ${openMenu === 'mötespunkter' ? 'nav-item-wrapper--open' : ''}`}>
            <button
              className={`nav-item ${activeView === 'mötespunkter' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'mötespunkter' ? null : 'mötespunkter')}
              aria-expanded={openMenu === 'mötespunkter'}
              aria-haspopup="true"
            >
              Mötespunkter
              <svg className={`nav-arrow ${openMenu === 'mötespunkter' ? 'nav-arrow--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {openMenu === 'mötespunkter' && (
              <div className="nav-dropdown" role="menu">
                <button
                  className={`nav-dropdown-item ${activeView === 'mötespunkter' && !showArchivedMeetings ? 'nav-dropdown-item--current' : ''}`}
                  onClick={() => {
                    onViewChange('mötespunkter')
                    if (showArchivedMeetings && onArchivedMeetingsClick) onArchivedMeetingsClick()
                    setOpenMenu(null)
                  }}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  <span>Aktiva möten</span>
                </button>
                {onArchivedMeetingsClick && (
                  <button
                    className={`nav-dropdown-item ${activeView === 'mötespunkter' && showArchivedMeetings ? 'nav-dropdown-item--current' : ''}`}
                    onClick={() => {
                      onViewChange('mötespunkter')
                      if (!showArchivedMeetings) onArchivedMeetingsClick()
                      setOpenMenu(null)
                    }}
                    role="menuitem"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                    </svg>
                    <span>Arkiverade möten</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>
      <div className="header-actions">
        <a href="/admin" className="admin-link">
          Admin
        </a>
        {version && (
          <button className="version-badge" onClick={onVersionClick}>
            v{version}
          </button>
        )}
      </div>
    </header>
  )
}
