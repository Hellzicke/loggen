interface HeaderProps {
  version: string
  onVersionClick: () => void
  onArchiveClick: () => void
  archiveCount: number
  activeView: 'logg' | 'förslagslåda' | 'mötespunkter'
  onViewChange: (view: 'logg' | 'förslagslåda' | 'mötespunkter') => void
}

export default function Header({ version, onVersionClick, onArchiveClick, archiveCount, activeView, onViewChange }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-left">
        <h1>Loggen</h1>
        <nav className="main-nav">
          <div className="nav-item-wrapper">
            <button 
              className={`nav-item ${activeView === 'logg' ? 'active' : ''}`}
              onClick={() => onViewChange('logg')}
            >
              Logg
              <svg className="nav-arrow" width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="nav-dropdown">
              <button className="nav-dropdown-item" onClick={onArchiveClick}>
                <span>Arkiv</span>
                {archiveCount > 0 && <span className="archive-count">{archiveCount}</span>}
              </button>
            </div>
          </div>
          <button 
            className={`nav-item ${activeView === 'förslagslåda' ? 'active' : ''}`}
            onClick={() => onViewChange('förslagslåda')}
          >
            Förslagslåda
          </button>
          <button 
            className={`nav-item ${activeView === 'mötespunkter' ? 'active' : ''}`}
            onClick={() => onViewChange('mötespunkter')}
          >
            Mötespunkter
          </button>
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
