import { useState, useEffect, useRef, useCallback } from 'react'
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
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type Fetcher = (url: string, options?: RequestInit) => Promise<Response>

interface NewsletterProps {
  authenticatedFetch: Fetcher
  adminFetch: Fetcher
  isAdmin: boolean
  onSeen?: () => void
}

export const NEWSLETTER_SEEN_KEY = 'newsletterSeenAt'

const STATUS_LABELS: Record<Status, string> = { pågår: 'Pågår', planerad: 'Planerad', pausad: 'Pausad', klar: 'Klar' }
const STATUS_ORDER: Status[] = ['pågår', 'planerad', 'pausad', 'klar']

const SECTION_TITLES: Record<Section, string> = {
  status: 'Status',
  event: 'Kommande händelser',
  info: 'Planering & information',
}

const fmtDate = (value: string) => new Date(value).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

interface EditState {
  id: number | null
  section: Section
  title: string
  body: string
  status: Status
  eventDate: string
}

export default function Newsletter({ authenticatedFetch, adminFetch, isAdmin, onSeen }: NewsletterProps) {
  const [items, setItems] = useState<NewsletterItem[] | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [deleteItem, setDeleteItem] = useState<NewsletterItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)

  // Tidpunkten för förra besöket styr markeringarna "Nytt"/"Uppdaterat" under hela besöket
  const [lastSeen] = useState<number>(() => {
    try { return Number(localStorage.getItem(NEWSLETTER_SEEN_KEY)) || 0 } catch { return 0 }
  })

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

  useEffect(() => {
    if (!items) return
    try { localStorage.setItem(NEWSLETTER_SEEN_KEY, String(Date.now())) } catch {}
    onSeen?.()
  }, [items, onSeen])

  if (!items) return <div className="loading">Laddar nyhetsbrev...</div>

  const badge = (item: NewsletterItem) => {
    if (!lastSeen) return null
    if (new Date(item.createdAt).getTime() > lastSeen) return <span className="nb-tag nb-tag--new">Nytt</span>
    if (new Date(item.updatedAt).getTime() > lastSeen) return <span className="nb-tag nb-tag--updated">Uppdaterat</span>
    return null
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

  const lastUpdated = items.reduce((max, i) => Math.max(max, new Date(i.updatedAt).getTime()), 0)

  const openNew = (section: Section) => {
    setError(null)
    setEdit({ id: null, section, title: '', body: '', status: 'pågår', eventDate: '' })
  }

  const openEdit = (item: NewsletterItem) => {
    setError(null)
    setEdit({
      id: item.id,
      section: item.section,
      title: item.title,
      body: item.body,
      status: (item.status as Status) || 'pågår',
      eventDate: item.eventDate ? item.eventDate.slice(0, 10) : '',
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
  }

  const adminActions = (item: NewsletterItem) => isAdmin && (
    <div className="nb-item-actions">
      <button className="nb-link-btn" onClick={() => openEdit(item)}>Redigera</button>
      <button className="nb-link-btn nb-link-btn--danger" onClick={() => setDeleteItem(item)}>Ta bort</button>
    </div>
  )

  const sectionHeader = (section: Section) => (
    <div className="nb-section-header">
      <h2>{SECTION_TITLES[section]}</h2>
      {isAdmin && <button className="nb-add-btn" onClick={() => openNew(section)}>+ Lägg till</button>}
    </div>
  )

  return (
    <div className="nb">
      <div className="nb-top">
        <h1>Nyhetsbrev</h1>
        {lastUpdated > 0 && <span className="nb-updated">Senast uppdaterad {fmtDate(new Date(lastUpdated).toISOString())}</span>}
      </div>

      <section className="nb-section">
        {sectionHeader('status')}
        {statusItems.length === 0 ? <div className="nb-empty">Inget att visa</div> : (
          <div className="nb-status-list">
            {statusItems.map(item => (
              <div key={item.id} className="nb-card nb-status-row">
                <span className={`nb-status nb-status--${item.status}`}>{STATUS_LABELS[item.status as Status]}</span>
                <div className="nb-status-main">
                  <div className="nb-item-title">{item.title} {badge(item)}</div>
                  {item.body && <div className="nb-item-text">{item.body}</div>}
                  <div className="nb-item-meta">Uppdaterad {fmtDate(item.updatedAt)}</div>
                </div>
                {adminActions(item)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="nb-section">
        {sectionHeader('event')}
        {eventItems.length === 0 ? <div className="nb-empty">Inga kommande händelser</div> : (
          <div className="nb-event-list">
            {eventItems.map(item => {
              const d = new Date(item.eventDate!)
              return (
                <div key={item.id} className="nb-card nb-event-row">
                  <div className="nb-event-date">
                    <span className="nb-event-day">{d.getDate()}</span>
                    <span className="nb-event-month">{d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '')}</span>
                    <span className="nb-event-weekday">{d.toLocaleDateString('sv-SE', { weekday: 'short' })}</span>
                  </div>
                  <div className="nb-status-main">
                    <div className="nb-item-title">{item.title} {badge(item)}</div>
                    {item.body && <div className="nb-item-text">{item.body}</div>}
                  </div>
                  {adminActions(item)}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="nb-section">
        {sectionHeader('info')}
        {infoItems.length === 0 ? <div className="nb-empty">Inget att visa</div> : (
          <div className="nb-info-list">
            {infoItems.map(item => (
              <article key={item.id} className="nb-card nb-info">
                <div className="nb-info-head">
                  <h3>{item.title} {badge(item)}</h3>
                  {adminActions(item)}
                </div>
                <div className="nb-info-body log-message" dangerouslySetInnerHTML={{ __html: item.body }} />
                <div className="nb-item-meta">Uppdaterad {fmtDate(item.updatedAt)}</div>
              </article>
            ))}
          </div>
        )}
      </section>

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
          message={`Ta bort "${deleteItem.title}" från nyhetsbrevet?`}
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteItem(null)}
        />
      )}
    </div>
  )
}
