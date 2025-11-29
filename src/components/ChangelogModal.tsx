import { useState, useEffect } from 'react'

interface ChangelogModalProps {
  onClose: () => void
}

interface ChangelogEntry {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

function parseChangelog(markdown: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  const lines = markdown.split('\n')
  
  let currentEntry: ChangelogEntry | null = null
  let currentSection: { title: string; items: string[] } | null = null

  for (const line of lines) {
    // Version header: ## [0.1.3] - 2025-11-29
    const versionMatch = line.match(/^## \[(.+)\] - (.+)$/)
    if (versionMatch) {
      if (currentEntry) {
        if (currentSection) currentEntry.sections.push(currentSection)
        entries.push(currentEntry)
      }
      currentEntry = {
        version: versionMatch[1],
        date: versionMatch[2],
        sections: []
      }
      currentSection = null
      continue
    }

    // Section header: ### Tillagt
    const sectionMatch = line.match(/^### (.+)$/)
    if (sectionMatch && currentEntry) {
      if (currentSection) currentEntry.sections.push(currentSection)
      currentSection = { title: sectionMatch[1], items: [] }
      continue
    }

    // List item: - Something
    const itemMatch = line.match(/^- (.+)$/)
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1])
    }
  }

  if (currentEntry) {
    if (currentSection) currentEntry.sections.push(currentSection)
    entries.push(currentEntry)
  }

  return entries
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`
}

export default function ChangelogModal({ onClose }: ChangelogModalProps) {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/changelog')
      .then(res => res.json())
      .then(data => setEntries(parseChangelog(data.changelog)))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ändringslogg</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="changelog-content">
          {loading ? (
            <div className="changelog-loading">Laddar...</div>
          ) : entries.length === 0 ? (
            <div className="changelog-empty">Ingen ändringslogg tillgänglig</div>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className="changelog-entry">
                <div className="changelog-version">
                  <span className="version-number">v{entry.version}</span>
                  <span className="version-date">{formatDate(entry.date)}</span>
                </div>
                {entry.sections.map((section, j) => (
                  <div key={j} className="changelog-section">
                    <div className="section-title">{section.title}</div>
                    <ul className="section-items">
                      {section.items.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
