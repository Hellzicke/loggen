import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor'
import ConfirmModal from './ConfirmModal'

type Section = 'status' | 'event' | 'info'
type Status = 'planerad' | 'pågår' | 'klar' | 'pausad'

export interface NewsletterItem {
  id: number
  section: Section
  title: string
  body: string
  status: Status | null
  eventDate: string | null
  startTime: string | null
  endTime: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type Fetcher = (url: string, options?: RequestInit) => Promise<Response>

interface NewsletterProps {
  authenticatedFetch: Fetcher
  adminFetch: Fetcher
  isAdmin: boolean
}

// Per punkt: när den senast öppnades (ms). Punkter som ändrats efter det markeras som nya.
const SEEN_KEY = 'newsletterSeen'

const STATUS_LABELS: Record<Status, string> = { pågår: 'Pågår', planerad: 'Planerad', pausad: 'Pausad', klar: 'Klar' }
const STATUS_ORDER: Status[] = ['pågår', 'planerad', 'pausad', 'klar']
const SECTION_TITLES: Record<Section, string> = { status: 'Status', event: 'Kommande händelser', info: 'Planering & information' }

const fmtShort = (value: string) => new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
const fmtLong = (value: string) => new Date(value).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

// Tidsval i 24-timmarsformat oberoende av webbläsarens språk
function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [h = '', m = ''] = value ? value.split(':') : []
  return (
    <div className="nb-time">
      <select className="nb-input" value={h} onChange={e => onChange(e.target.value ? `${e.target.value}:${m || '00'}` : '')}>
        <option value="">--</option>
        {HOURS.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
      <span>:</span>
      <select className="nb-input" value={m} disabled={!h} onChange={e => onChange(`${h}:${e.target.value}`)}>
        {!h && <option value="">--</option>}
        {MINUTES.map(x => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  )
}

const timeRange = (item: { startTime: string | null; endTime: string | null }) =>
  item.startTime ? (item.endTime ? `${item.startTime}–${item.endTime}` : item.startTime) : ''

function readSeen(): Record<number, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') } catch { return {} }
}

interface EditState {
  id: number | null
  section: Section
  title: string
  body: string
  status: Status
  eventDate: string
  startTime: string
  endTime: string
}

export default function Newsletter({ authenticatedFetch, adminFetch, isAdmin }: NewsletterProps) {
  const [items, setItems] = useState<NewsletterItem[] | null>(null)
  const [seen, setSeen] = useState<Record<number, number>>(readSeen)
  const [open, setOpen] = useState(false) // hopfällt läge på smala skärmar
  const [viewing, setViewing] = useState<NewsletterItem | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [deleteItem, setDeleteItem] = useState<NewsletterItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/newsletter')
      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch newsletter:', err)
      setItems([])
    }
  }, [authenticatedFetch])

  useEffect(() => { load() }, [load])

  if (!items) return null

  const isUnread = (item: NewsletterItem) => (seen[item.id] || 0) < new Date(item.updatedAt).getTime()

  const openItem = (item: NewsletterItem) => {
    setViewing(item)
    const next = { ...seen, [item.id]: Date.now() }
    setSeen(next)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch {}
  }

  const statusItems = items
    .filter(i => i.section === 'status')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status)
      || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const eventItems = items
    .filter(i => i.section === 'event' && i.eventDate && new Date(i.eventDate).getTime() >= startOfToday())
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
  const infoItems = items
    .filter(i => i.section === 'info')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const unreadCount = [...statusItems, ...eventItems, ...infoItems].filter(isUnread).length
  const lastUpdated = items.reduce((max, i) => Math.max(max, new Date(i.updatedAt).getTime()), 0)

  const openNew = (section: Section) => {
    setError(null)
    setEdit({ id: null, section, title: '', body: '', status: 'pågår', eventDate: '', startTime: '', endTime: '' })
  }

  const openEdit = (item: NewsletterItem) => {
    setViewing(null)
    setError(null)
    setEdit({
      id: item.id,
      section: item.section,
      title: item.title,
      body: item.body,
      status: (item.status as Status) || 'pågår',
      eventDate: item.eventDate ? item.eventDate.slice(0, 10) : '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
    })
  }

  const save = async () => {
    if (!edit) return
    const body = edit.section === 'info' ? (editorRef.current?.getValue() || '') : edit.body
    setSaving(true)
    setError(null)
    try {
      const res = await adminFetch(edit.id ? `/api/admin/newsletter/${edit.id}` : '/api/admin/newsletter', {
        method: edit.id ? 'PUT' : 'POST',
        body: JSON.stringify({
          section: edit.section,
          title: edit.title,
          body,
          status: edit.status,
          eventDate: edit.eventDate ? `${edit.eventDate}T12:00:00` : null,
          startTime: edit.startTime || null,
          endTime: edit.endTime || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Kunde inte spara'); return }
      setEdit(null)
      await load()
    } catch {
      setError('Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteItem) return
    try {
      await adminFetch(`/api/admin/newsletter/${deleteItem.id}`, { method: 'DELETE' })
      await load()
    } catch (err) {
      console.error('Failed to delete newsletter item:', err)
    }
    setDeleteItem(null)
    setViewing(null)
  }

  const group = (section: Section, list: NewsletterItem[], render: (item: NewsletterItem) => JSX.Element) => (
    (list.length > 0 || isAdmin) && (
      <div className="nbp-group">
        <div className="nbp-group-head">
          <span>{SECTION_TITLES[section]}</span>
          {isAdmin && <button className="nbp-add" onClick={() => openNew(section)} title="Lägg till">+</button>}
        </div>
        {list.length === 0
          ? <div className="nbp-empty">Inget just nu</div>
          : list.map(item => (
            <button key={item.id} className="nbp-row" onClick={() => openItem(item)}>
              {render(item)}
              {isUnread(item) && <span className="nbp-unread" aria-label="Nytt" />}
            </button>
          ))}
      </div>
    )
  )

  return (
    <aside className={`nbp ${open ? 'nbp--open' : ''}`}>
      <button className="nbp-head" onClick={() => setOpen(!open)}>
        <span className="nbp-head-text">
          <span className="nbp-title">Aktuellt från Micke</span>
          {(lastUpdated > 0 || unreadCount > 0) && (
            <span className="nbp-meta">
              {lastUpdated > 0 && <>Uppdaterad {fmtShort(new Date(lastUpdated).toISOString())}</>}
              {lastUpdated > 0 && unreadCount > 0 && ' · '}
              {unreadCount > 0 && <span className="nbp-count">{unreadCount} {unreadCount === 1 ? 'ny' : 'nya'}</span>}
            </span>
          )}
        </span>
        <svg className="nbp-chevron" width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <div className="nbp-body">
        {items.length === 0 && !isAdmin && <div className="nbp-empty">Inget aktuellt just nu</div>}
        {group('status', statusItems, item => (
          <>
            <span className={`nbp-dot nbp-dot--${item.status}`} title={STATUS_LABELS[item.status as Status]} />
            <span className="nbp-row-title">{item.title}</span>
          </>
        ))}
        {group('event', eventItems, item => (
          <>
            <span className="nbp-date">{fmtShort(item.eventDate!)}{item.startTime && <span className="nbp-time">{item.startTime}</span>}</span>
            <span className="nbp-row-title">{item.title}</span>
          </>
        ))}
        {group('info', infoItems, item => <span className="nbp-row-title">{item.title}</span>)}
      </div>

      {createPortal(<>
      {viewing && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setViewing(null) }}>
          <div className="modal nb-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{viewing.title}</h2>
              <button className="modal-close" onClick={() => setViewing(null)}>×</button>
            </div>
            <div className="nb-view">
              <div className="nb-view-meta">
                <span className="nb-view-section">{SECTION_TITLES[viewing.section]}</span>
                {viewing.status && <span className={`nb-status nb-status--${viewing.status}`}>{STATUS_LABELS[viewing.status]}</span>}
                {viewing.eventDate && <span className="nb-view-date">{fmtLong(viewing.eventDate)}{viewing.startTime ? ` kl. ${timeRange(viewing)}` : ''}</span>}
              </div>
              {viewing.body && (viewing.section === 'info'
                ? <div className="log-message" dangerouslySetInnerHTML={{ __html: viewing.body }} />
                : <div className="nb-view-text">{viewing.body}</div>)}
              <div className="nb-view-updated">Uppdaterad {fmtLong(viewing.updatedAt)}</div>
              {isAdmin && (
                <div className="nb-form-actions">
                  <button className="confirm-btn confirm-btn--secondary" onClick={() => setDeleteItem(viewing)}>Ta bort</button>
                  <button className="confirm-btn confirm-btn--primary" onClick={() => openEdit(viewing)}>Redigera</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {edit && (
        <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="modal nb-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{edit.id ? 'Redigera' : 'Lägg till'} – {SECTION_TITLES[edit.section]}</h2>
              <button className="modal-close" onClick={() => setEdit(null)}>×</button>
            </div>
            <div className="nb-form">
              {error && <div className="nb-error">{error}</div>}
              <label className="nb-label">Rubrik</label>
              <input className="nb-input" value={edit.title} onChange={e => setEdit({ ...edit, title: e.target.value })} autoFocus />

              {edit.section === 'status' && (
                <>
                  <label className="nb-label">Status</label>
                  <div className="nb-status-picker">
                    {STATUS_ORDER.map(s => (
                      <button key={s} type="button" className={`nb-status nb-status--${s} ${edit.status === s ? 'nb-status--selected' : ''}`} onClick={() => setEdit({ ...edit, status: s })}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {edit.section === 'event' && (
                <>
                  <label className="nb-label">Datum</label>
                  <input className="nb-input" type="date" value={edit.eventDate} onChange={e => setEdit({ ...edit, eventDate: e.target.value })} />
                  <div className="nb-time-row">
                    <div>
                      <label className="nb-label">Starttid (frivillig)</label>
                      <TimeSelect value={edit.startTime} onChange={v => setEdit({ ...edit, startTime: v })} />
                    </div>
                    <div>
                      <label className="nb-label">Sluttid (frivillig)</label>
                      <TimeSelect value={edit.endTime} onChange={v => setEdit({ ...edit, endTime: v })} />
                    </div>
                  </div>
                </>
              )}

              <label className="nb-label">{edit.section === 'info' ? 'Text' : 'Kommentar'}</label>
              {edit.section === 'info'
                ? <RichTextEditor ref={editorRef} initialValue={edit.body} />
                : <textarea className="nb-input nb-textarea" rows={4} value={edit.body} onChange={e => setEdit({ ...edit, body: e.target.value })} />}

              <div className="nb-form-actions">
                <button className="confirm-btn confirm-btn--secondary" onClick={() => setEdit(null)}>Avbryt</button>
                <button className="confirm-btn confirm-btn--primary" onClick={save} disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteItem && (
        <ConfirmModal
          title="Ta bort"
          message={`Ta bort "${deleteItem.title}" från Aktuellt?`}
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteItem(null)}
        />
      )}
      </>, document.body)}
    </aside>
  )
}
