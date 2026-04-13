import { useEffect, useRef, useState } from 'react'

export type SuggestionFilter = 'förslag' | 'förslag-arkiv' | 'bugg' | 'funktion'
export type MainView = 'logg' | 'förslagslåda' | 'mötespunkter' | 'utveckling'

interface HeaderProps {
  version: string
  onVersionClick: () => void
  onArchiveClick: () => void
  archiveCount: number
  activeView: MainView
  onViewChange: (view: MainView) => void
  onArchivedMeetingsClick?: () => void
  showArchivedMeetings?: boolean
  suggestionFilter?: SuggestionFilter
  onSuggestionFilterChange?: (filter: SuggestionFilter) => void
}

type MenuKey = 'logg' | 'mötespunkter' | 'förslagslåda' | 'utveckling' | null

export default function Header({ version, onVersionClick, onArchiveClick, archiveCount, activeView, onViewChange, onArchivedMeetingsClick, showArchivedMeetings, suggestionFilter = 'förslag', onSuggestionFilterChange }: HeaderProps) {
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

  const handleGoTo = (view: MainView) => {
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

          <div className={`nav-item-wrapper ${openMenu === 'förslagslåda' ? 'nav-item-wrapper--open' : ''}`}>
            <button
              className={`nav-item ${activeView === 'förslagslåda' ? 'active' : ''}`}
              onClick={() => setOpenMenu(openMenu === 'förslagslåda' ? null : 'förslagslåda')}
              aria-expanded={openMenu === 'förslagslåda'}
              aria-haspopup="true"
            >
              Förslagslåda
              <svg className={`nav-arrow ${openMenu === 'förslagslåda' ? 'nav-arrow--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {openMenu === 'förslagslåda' && (
              <div className="nav-dropdown" role="menu">
                <button
                  className={`nav-dropdown-item ${activeView === 'förslagslåda' && suggestionFilter === 'förslag' ? 'nav-dropdown-item--current' : ''}`}
                  onClick={() => { onViewChange('förslagslåda'); onSuggestionFilterChange?.('förslag'); setOpenMenu(null) }}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                  </svg>
                  <span>Aktiva förslag</span>
                </button>
                <button
                  className={`nav-dropdown-item ${activeView === 'förslagslåda' && suggestionFilter === 'förslag-arkiv' ? 'nav-dropdown-item--current' : ''}`}
                  onClick={() => { onViewChange('förslagslåda'); onSuggestionFilterChange?.('förslag-arkiv'); setOpenMenu(null) }}
                  role="menuitem"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
                  </svg>
                  <span>Arkiv</span>
                </button>
              </div>
            )}
          </div>

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
        <div className={`nav-item-wrapper nav-item-wrapper--compact ${openMenu === 'utveckling' ? 'nav-item-wrapper--open' : ''}`}>
          <button
            className={`nav-item nav-item--compact ${activeView === 'utveckling' ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === 'utveckling' ? null : 'utveckling')}
            aria-expanded={openMenu === 'utveckling'}
            aria-haspopup="true"
            title="Utveckling & admin"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <svg className={`nav-arrow ${openMenu === 'utveckling' ? 'nav-arrow--open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {openMenu === 'utveckling' && (
            <div className="nav-dropdown nav-dropdown--right" role="menu">
              <button
                className={`nav-dropdown-item ${activeView === 'utveckling' && suggestionFilter === 'bugg' ? 'nav-dropdown-item--current' : ''}`}
                onClick={() => { onViewChange('utveckling'); onSuggestionFilterChange?.('bugg'); setOpenMenu(null) }}
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20c-3.5 0-6-2.5-6-6v-3a6 6 0 0112 0v3c0 3.5-2.5 6-6 6zM8 8V6a4 4 0 118 0v2M2 12h4M18 12h4M3 4l3 3M21 4l-3 3M3 20l3-3M21 20l-3-3" />
                </svg>
                <span>Buggrapporter</span>
              </button>
              <button
                className={`nav-dropdown-item ${activeView === 'utveckling' && suggestionFilter === 'funktion' ? 'nav-dropdown-item--current' : ''}`}
                onClick={() => { onViewChange('utveckling'); onSuggestionFilterChange?.('funktion'); setOpenMenu(null) }}
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                <span>Funktionsönskemål</span>
              </button>
              <div className="nav-dropdown-divider" />
              <a href="/admin" className="nav-dropdown-item" role="menuitem">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>Admin</span>
              </a>
            </div>
          )}
        </div>
        {version && (
          <button className="version-badge" onClick={onVersionClick}>
            v{version}
          </button>
        )}
      </div>
    </header>
  )
}
