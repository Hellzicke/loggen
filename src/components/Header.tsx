interface HeaderProps {
  version: string
  onVersionClick: () => void
  onArchiveClick: () => void
  archiveCount: number
}

export default function Header({ version, onVersionClick, onArchiveClick, archiveCount }: HeaderProps) {
  return (
    <header className="header">
      <h1>Loggen</h1>
      <div className="header-actions">
        <a href="/admin" className="admin-link">
          Admin
        </a>
        <button className="archive-badge" onClick={onArchiveClick}>
          Arkiv {archiveCount > 0 && <span className="archive-count">{archiveCount}</span>}
        </button>
        {version && (
          <button className="version-badge" onClick={onVersionClick}>
            v{version}
          </button>
        )}
      </div>
    </header>
  )
}
