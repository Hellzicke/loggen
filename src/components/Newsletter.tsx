import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor'
import ConfirmModal from './ConfirmModal'
import EmployeeNameInput from './EmployeeNameInput'

type Section = 'status' | 'event' | 'info'
type Status = 'planerad' | 'pågår' | 'klar' | 'pausad'

export interface NewsletterItem {
  id: number
  section: Section
  title: string
  body: string
  status: Status | null
  eventDate: string | null
  eventEndDate: string | null
  startTime: string | null
  endTime: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  signatures: Array<{ id: number; name: string; createdAt: string }>
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

const SECTION_ICONS: Record<Section, JSX.Element> = {
  status: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  event: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></svg>,
}

const fmtShort =(value: string) => new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }).replace('.', '')
const fmtLong = (value: string) => new Date(value).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })

// Datumintervall i kort form: "26–30 okt", "30 okt–2 nov", "25 nov"
function fmtRange(start: string, end: string | null) {
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return fmtShort(start)
  const s = new Date(start), e = new Date(end)
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${fmtShort(end)}`
  return `${fmtShort(start)}–${fmtShort(end)}`
}

const looksLikeHtml = (text: string) => /<[a-z][sS]*>/i.test(text)

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
  eventEndDate: string
  startTime: string
  endTime: string
}

export default function Newsletter({ authenticatedFetch, adminFetch, isAdmin }: NewsletterProps) {
  const [items, setItems] = useState<NewsletterItem[] | null>(null)
  const [seen, setSeen] = useState<Record<number, number>>(readSeen)
  const [open, setOpen] = useState(false) // hopfällt läge på smala skärmar
  const [viewing, setViewing] = useState<NewsletterItem | null>(null)
  const [signing, setSigning] = useState(false)
  const [signName, setSignName] = useState('')
  const [signError, setSignError] = useState('')
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
    setSigning(false)
    setSignError('')
    const next = { ...seen, [item.id]: Date.now() }
    setSeen(next)
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)) } catch {}
  }

  const statusItems = items
    .filter(i => i.section === 'status')
    .sort((a, b) => STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status)
      || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const eventItems = items
    .filter(i => i.section === 'event' && i.eventDate && new Date(i.eventEndDate || i.eventDate).getTime() >= startOfToday())
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
  const infoItems = items
    .filter(i => i.section === 'info')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const unreadCount = [...statusItems, ...eventItems, ...infoItems].filter(isUnread).length
  const lastUpdated = items.reduce((max, i) => Math.max(max, new Date(i.updatedAt).getTime()), 0)

  const openNew = (section: Section) => {
    setError(null)
    setEdit({ id: null, section, title: '', body: '', status: 'pågår', eventDate: '', eventEndDate: '', startTime: '', endTime: '' })
  }

  const openEdit = (item: NewsletterItem) => {
    setViewing(null)
    setError(null)
    setEdit({
      id: item.id,
      section: item.section,
      title: item.title,
      // Äldre punkter har ren text – gör om radbrytningar så de behålls i editorn
      body: looksLikeHtml(item.body) ? item.body : item.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'),
      status: (item.status as Status) || 'pågår',
      eventDate: item.eventDate ? item.eventDate.slice(0, 10) : '',
      eventEndDate: item.eventEndDate ? item.eventEndDate.slice(0, 10) : '',
      startTime: item.startTime || '',
      endTime: item.endTime || '',
    })
  }

  const save = async () => {
    if (!edit) return
    const body = editorRef.current?.getValue() || ''
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
          eventEndDate: edit.eventEndDate ? `${edit.eventEndDate}T12:00:00` : null,
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

  const signItem = async () => {
    if (!viewing || !signName.trim()) return
    setSignError('')
    try {
      const res = await authenticatedFetch(`/api/newsletter/${viewing.id}/sign`, { method: 'POST', body: JSON.stringify({ name: signName.trim() }) })
      if (res.status === 409) { setSignError('Du har redan signerat'); return }
      if (!res.ok) { setSignError('Kunde inte signera'); return }
      const signature = await res.json()
      const updated = { ...viewing, signatures: [...(viewing.signatures || []), signature] }
      setViewing(updated)
      setItems(prev => prev && prev.map(i => i.id === updated.id ? updated : i))
      setSigning(false)
      setSignName('')
    } catch {
      setSignError('Något gick fel')
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
      <div className={`nbp-group nbp-group--${section}`}>
        <div className="nbp-group-head">
          <span className="nbp-group-icon">{SECTION_ICONS[section]}</span>
          <span className="nbp-group-title">{SECTION_TITLES[section]}</span>
          {list.length > 0 && <span className="nbp-group-count">{list.length}</span>}
          {isAdmin && <button className="nbp-add" onClick={() => openNew(section)} title="Lägg till">+</button>}
        </div>
        {list.length === 0
          ? <div className="nbp-empty">Inget just nu</div>
          : list.map(item => (
            <button key={item.id} className="nbp-row" onClick={() => openItem(item)}>
              {render(item)}
              {(item.signatures?.length || 0) > 0 && <span className="nbp-read" title={`Läst av ${item.signatures.length}`}>✓{item.signatures.length}</span>}
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
          <span className="nbp-title">Aktuellt i verksamheten</span>
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
            <span className="nbp-row-title">{item.title}</span>
            <span className={`nbp-status nbp-status--${item.status}`}>{STATUS_LABELS[item.status as Status]}</span>
          </>
        ))}
        {group('event', eventItems, item => (
          <>
            <span className="nbp-date">{fmtRange(item.eventDate!, item.eventEndDate)}</span>
            <span className="nbp-time">{item.startTime || ''}</span>
            <span className="nbp-row-title">{item.title}</span>
          </>
        ))}
        {group('info', infoItems, item => <span className="nbp-row-title">{item.title}</span>)}
      </div>

      {createPortal(<>
      {viewing && (
        <div className="nbm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setViewing(null) }}>
          <div className={`nbm nbm--${viewing.section}${viewing.status ? ` nbm--${viewing.status}` : ''}`} onClick={e => e.stopPropagation()}>
            <div className="nbm-hero">
              <button className="nbm-close" onClick={() => setViewing(null)} aria-label="Stäng">×</button>
              <div className="nbm-kicker">{SECTION_TITLES[viewing.section]}</div>
              <h2 className="nbm-title">{viewing.title}</h2>
              <div className="nbm-chips">
                {viewing.status && <span className={`nbm-chip nbm-chip--status nbm-chip--${viewing.status}`}>{STATUS_LABELS[viewing.status]}</span>}
                {viewing.eventDate && (
                  <span className="nbm-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                    {viewing.eventEndDate && viewing.eventEndDate.slice(0, 10) !== viewing.eventDate.slice(0, 10)
                      ? `${fmtLong(viewing.eventDate)} – ${fmtLong(viewing.eventEndDate)}`
                      : fmtLong(viewing.eventDate)}
                  </span>
                )}
                {viewing.startTime && (
                  <span className="nbm-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                    {timeRange(viewing)}
                  </span>
                )}
              </div>
            </div>
            {viewing.body && (
              <div className="nbm-body">
                {looksLikeHtml(viewing.body)
                  ? <div className="log-message" dangerouslySetInnerHTML={{ __html: viewing.body }} />
                  : <div className="nbm-text">{viewing.body}</div>}
              </div>
            )}
            <div className="nbm-read">
              <div className="nbm-read-list">
                <span className="nbm-read-label">Läst av</span>
                {(viewing.signatures || []).length === 0
                  ? <span className="nbm-read-none">ingen ännu</span>
                  : viewing.signatures.map(sig => <span key={sig.id} className="nbm-read-name">{sig.name}</span>)}
              </div>
              {signing ? (
                <div className="nbm-sign-form">
                  <EmployeeNameInput
                    value={signName}
                    onChange={setSignName}
                    selectClassName="nb-input"
                    inputClassName="nb-input"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && signItem()}
                  />
                  <button className="nbm-btn nbm-btn--primary" onClick={signItem} disabled={!signName.trim()}>Signera</button>
                  <button className="nbm-btn nbm-btn--ghost" onClick={() => { setSigning(false); setSignError('') }}>Avbryt</button>
                </div>
              ) : (
                <button className="nbm-sign-btn" onClick={() => setSigning(true)}>Signera som läst</button>
              )}
              {signError && <div className="nb-error">{signError}</div>}
            </div>
            <div className="nbm-footer">
              <span>Uppdaterad {fmtLong(viewing.updatedAt)}</span>
              {isAdmin && (
                <div className="nbm-actions">
                  <button className="nbm-btn nbm-btn--ghost" onClick={() => setDeleteItem(viewing)}>Ta bort</button>
                  <button className="nbm-btn nbm-btn--primary" onClick={() => openEdit(viewing)}>Redigera</button>
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
                  <div className="nb-time-row">
                    <div>
                      <label className="nb-label">Från och med</label>
                      <input className="nb-input" type="date" value={edit.eventDate} onChange={e => setEdit({ ...edit, eventDate: e.target.value, eventEndDate: edit.eventEndDate && edit.eventEndDate < e.target.value ? e.target.value : edit.eventEndDate })} />
                    </div>
                    <div>
                      <label className="nb-label">Till och med</label>
                      <input className="nb-input" type="date" value={edit.eventEndDate} min={edit.eventDate || undefined} onChange={e => setEdit({ ...edit, eventEndDate: e.target.value })} />
                    </div>
                  </div>
                  <div className="nb-time-row">
                    <div>
                      <label className="nb-label">Starttid</label>
                      <TimeSelect value={edit.startTime} onChange={v => setEdit({ ...edit, startTime: v })} />
                    </div>
                    <div>
                      <label className="nb-label">Sluttid</label>
                      <TimeSelect value={edit.endTime} onChange={v => setEdit({ ...edit, endTime: v })} />
                    </div>
                  </div>
                </>
              )}

              <label className="nb-label">{edit.section === 'status' ? 'Kommentar' : edit.section === 'event' ? 'Information' : 'Text'}</label>
              <RichTextEditor ref={editorRef} initialValue={edit.body} />

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
          message={`Ta bort "${deleteItem.title}" från Aktuellt i verksamheten?`}
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
