interface HeaderProps {
  version: string
  onVersionClick: () => void
}

export default function Header({ version, onVersionClick }: HeaderProps) {
  return (
    <header className="header">
      <h1>Loggen</h1>
      {version && (
        <button className="version-badge" onClick={onVersionClick}>
          v{version}
        </button>
      )}
    </header>
  )
}

