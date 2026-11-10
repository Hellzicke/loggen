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
  completedAt: string | null
  attachments: Attachment[]
  eventDate: string | null
  eventEndDate: string | null
  startTime: string | null
  endTime: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  signatures: Signature[]
  updates: NewsletterUpdate[]
}

type Signature = { id: number; name: string; createdAt: string }
type Attachment = { url: string; originalName: string; mimeType: string; size: number }

export interface NewsletterUpdate {
  id: number
  itemId: number
  body: string
  attachments: Attachment[]
  createdAt: string
  updatedAt: string
  signatures: Signature[]
}

const fmtSize = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`

function FileList({ files }: { files: Attachment[] }) {
  if (!files || files.length === 0) return null
  return (
    <div className="nbm-files">
      {files.map((a, idx) => (
        <a key={`${a.url}-${idx}`} href={a.url} target="_blank" rel="noreferrer" className="nbm-file">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
          <span className="nbm-file-name">{a.originalName}</span>
          {a.size > 0 && <span className="nbm-file-size">{fmtSize(a.size)}</span>}
        </a>
      ))}
    </div>
  )
}

// "Läst av" + signera, används för huvudinlägget och för varje uppdatering
function SignBox({ signatures, onSign }: { signatures: Signature[]; onSign: (name: string) => Promise<string | null> }) {
  const [signing, setSigning] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    if (!name.trim()) return
    const err = await onSign(name.trim())
    if (err) { setError(err); return }
    setSigning(false)
    setName('')
    setError('')
  }
  return (
    <div className="nbm-read">
      <div className="nbm-read-list">
        <span className="nbm-read-label">Läst av</span>
        {(signatures || []).length === 0
          ? <span className="nbm-read-none">ingen ännu</span>
          : signatures.map(sig => <span key={sig.id} className="nbm-read-name">{sig.name}</span>)}
      </div>
      {signing ? (
        <div className="nbm-sign-form">
          <EmployeeNameInput value={name} onChange={setName} selectClassName="nb-input" inputClassName="nb-input" autoFocus onKeyDown={e => e.key === 'Enter' && submit()} />
          <button className="nbm-btn nbm-btn--primary" onClick={submit} disabled={!name.trim()}>Signera</button>
          <button className="nbm-btn nbm-btn--ghost" onClick={() => { setSigning(false); setError('') }}>Avbryt</button>
        </div>
      ) : (
        <button className="nbm-sign-btn" onClick={() => setSigning(true)}>Signera som läst</button>
      )}
      {error && <div className="nb-error">{error}</div>}
    </div>
  )
}

const fmtDateTime = (value: string) => new Date(value).toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')

type Fetcher = (url: string, options?: RequestInit) => Promise<Response>

interface NewsletterProps {
  authenticatedFetch: Fetcher
  adminFetch: Fetcher
  isAdmin: boolean
}


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

const looksLikeHtml = (text: string) => /<[a-z][\s\S]*>/i.test(text)

const ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000

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


interface EditState {
  id: number | null
  section: Section
  title: string
  body: string
  status: Status
  eventDate: string
  eventEndDate: string
  done: boolean
  attachments: Attachment[]
  startTime: string
  endTime: string
}

export default function Newsletter({ authenticatedFetch, adminFetch, isAdmin }: NewsletterProps) {
  const [items, setItems] = useState<NewsletterItem[] | null>(null)
  const [open, setOpen] = useState(false) // hopfällt läge på smala skärmar
  const [viewing, setViewing] = useState<NewsletterItem | null>(null)
  // Uppdatering som admin skriver/redigerar i visningsrutan (id null = ny)
  const [updEdit, setUpdEdit] = useState<{ id: number | null; body: string; attachments: Attachment[] } | null>(null)
  const [updError, setUpdError] = useState<string | null>(null)
  const [updSaving, setUpdSaving] = useState(false)
  const [updUploading, setUpdUploading] = useState(false)
  const [deleteUpdate, setDeleteUpdate] = useState<NewsletterUpdate | null>(null)
  const updEditorRef = useRef<RichTextEditorRef>(null)
  const updFileRef = useRef<HTMLInputElement>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [deleteItem, setDeleteItem] = useState<NewsletterItem | null>(null)
  const [showArchive, setShowArchive] = useState<Section | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const editorRef = useRef<RichTextEditorRef>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Bilder går via bilduppladdningen, dokument via bilageuppladdningen (samma som loggens inlägg)
  const uploadFile = async (file: File) => {
    const isImage = file.type.startsWith('image/')
    const form = new FormData()
    form.append(isImage ? 'image' : 'file', file)
    const res = await authenticatedFetch(isImage ? '/api/upload' : '/api/attachments/upload', { method: 'POST', body: form })
    if (!res.ok) throw new Error(`Filen ${file.name} kunde inte laddas upp`)
    const data = await res.json()
    return { url: data.url, originalName: data.originalName || file.name, mimeType: data.mimeType || file.type, size: data.size || file.size }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || !edit) return
    setUploading(true)
    setError(null)
    try {
      const uploaded: Attachment[] = []
      for (const file of Array.from(files)) uploaded.push(await uploadFile(file))
      setEdit(prev => prev && { ...prev, body: editorRef.current?.getValue() ?? prev.body, attachments: [...prev.attachments, ...uploaded] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uppladdningen misslyckades')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const load = useCallback(async (): Promise<NewsletterItem[]> => {
    try {
      const res = await authenticatedFetch('/api/newsletter')
      const data = await res.json()
      const list: NewsletterItem[] = Array.isArray(data) ? data : []
      setItems(list)
      return list
    } catch (err) {
      console.error('Failed to fetch newsletter:', err)
      setItems([])
      return []
    }
  }, [authenticatedFetch])

  // Läs om och visa den öppna punkten med färsk data
  const reloadViewing = async (itemId: number) => {
    const list = await load()
    setViewing(list.find(i => i.id === itemId) || null)
  }

  useEffect(() => { load() }, [load])

  if (!items) return null

  const latestUpdate = (item: NewsletterItem) => (item.updates || [])[item.updates.length - 1] || null

  const openItem = (item: NewsletterItem) => {
    setViewing(item)
    setUpdEdit(null)
    setUpdError(null)
  }

  // Klara statusar och informationspunkter ligger kvar i en vecka och hamnar sedan i arkivet
  const isArchived = (i: NewsletterItem) =>
    i.section !== 'event' && !!i.completedAt && Date.now() - new Date(i.completedAt).getTime() > ARCHIVE_AFTER_MS
  const archivedIn = (section: Section) => items
    .filter(i => i.section === section && isArchived(i))
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())
  const archivedItems = showArchive ? archivedIn(showArchive) : []
  const statusItems = items
    .filter(i => i.section === 'status' && !isArchived(i))
    .sort((a, b) => STATUS_ORDER.indexOf(a.status as Status) - STATUS_ORDER.indexOf(b.status as Status)
      || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const eventItems = items
    .filter(i => i.section === 'event' && i.eventDate && new Date(i.eventEndDate || i.eventDate).getTime() >= startOfToday())
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
  const infoItems = items
    .filter(i => i.section === 'info' && !isArchived(i))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const lastUpdated = items.reduce((max, i) => Math.max(
    max,
    new Date(i.updatedAt).getTime(),
    ...(i.updates || []).map(u => new Date(u.createdAt).getTime()),
  ), 0)

  const openNew = (section: Section) => {
    setError(null)
    setEdit({ id: null, section, title: '', body: '', status: 'pågår', eventDate: '', eventEndDate: '', done: false, attachments: [], startTime: '', endTime: '' })
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
      done: item.section === 'info' && !!item.completedAt,
      attachments: item.attachments || [],
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
          done: edit.done,
          attachments: edit.attachments,
          endTime: edit.endTime || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Kunde inte spara'); return }
      setEdit(null)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setSaving(false)
    }
  }

  // Signera huvudinlägget eller en uppdatering; returnerar felmeddelande eller null
  const signAs = (url: string, itemId: number) => async (name: string): Promise<string | null> => {
    try {
      const res = await authenticatedFetch(url, { method: 'POST', body: JSON.stringify({ name }) })
      if (res.status === 409) return 'Du har redan signerat'
      if (!res.ok) return 'Kunde inte signera'
      await reloadViewing(itemId)
      return null
    } catch {
      return 'Något gick fel'
    }
  }

  const handleUpdateFiles = async (files: FileList | null) => {
    if (!files || !updEdit) return
    setUpdUploading(true)
    setUpdError(null)
    try {
      const uploaded: Attachment[] = []
      for (const file of Array.from(files)) uploaded.push(await uploadFile(file))
      setUpdEdit(prev => prev && { ...prev, body: updEditorRef.current?.getValue() ?? prev.body, attachments: [...prev.attachments, ...uploaded] })
    } catch (err) {
      setUpdError(err instanceof Error ? err.message : 'Uppladdningen misslyckades')
    } finally {
      setUpdUploading(false)
      if (updFileRef.current) updFileRef.current.value = ''
    }
  }

  const saveUpdate = async () => {
    if (!viewing || !updEdit) return
    setUpdSaving(true)
    setUpdError(null)
    try {
      const payload = JSON.stringify({ body: updEditorRef.current?.getValue() || '', attachments: updEdit.attachments })
      const res = updEdit.id
        ? await adminFetch(`/api/admin/newsletter/updates/${updEdit.id}`, { method: 'PUT', body: payload })
        : await adminFetch(`/api/admin/newsletter/${viewing.id}/updates`, { method: 'POST', body: payload })
      const data = await res.json()
      if (!res.ok) { setUpdError(data.error || 'Kunde inte spara'); return }
      setUpdEdit(null)
      await reloadViewing(viewing.id)
    } catch (err) {
      setUpdError(err instanceof Error ? err.message : 'Kunde inte spara')
    } finally {
      setUpdSaving(false)
    }
  }

  const confirmDeleteUpdate = async () => {
    if (!deleteUpdate) return
    try {
      await adminFetch(`/api/admin/newsletter/updates/${deleteUpdate.id}`, { method: 'DELETE' })
      await reloadViewing(deleteUpdate.itemId)
    } catch (err) {
      console.error('Failed to delete update:', err)
    }
    setDeleteUpdate(null)
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

  // Rubrik med antal uppdateringar, t.ex. "Rekrytering (2)" – visas alltid när punkten har uppdateringar
  const rowTitle = (item: NewsletterItem) => {
    const count = (item.updates || []).length
    return (
      <span className="nbp-row-main">
        <span className="nbp-row-title">{item.title}</span>
        {count > 0 && <span className="nbp-update-count" title={`${count} ${count === 1 ? 'uppdatering' : 'uppdateringar'}`}>({count})</span>}
      </span>
    )
  }

  // Läst-antal: senaste uppdateringen om sådan finns (nollställs vid ny uppdatering), annars huvudinlägget.
  const rowMarkers = (item: NewsletterItem) => {
    const latest = latestUpdate(item)
    const readCount = (latest ? latest.signatures : item.signatures)?.length || 0
    return (
      <>
        {/* Läst-kolumnen finns alltid så att raderna ligger i linje */}
        <span className="nbp-read" title={readCount > 0 ? `Läst av ${readCount}` : undefined}>{readCount > 0 ? `✓${readCount}` : ''}</span>
      </>
    )
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
              {rowMarkers(item)}
            </button>
          ))}
      </div>
    )
  )

  const archiveLink = (section: Section) => {
    const count = archivedIn(section).length
    return count > 0 && (
      <button className="nbp-archive-link" onClick={() => setShowArchive(section)}>
        Arkiv – {SECTION_TITLES[section].toLowerCase()} ({count})
      </button>
    )
  }

  return (
    <aside className={`nbp ${open ? 'nbp--open' : ''}`}>
      <button className="nbp-head" onClick={() => setOpen(!open)}>
        <span className="nbp-head-text">
          <span className="nbp-title">Aktuellt i verksamheten</span>
          {lastUpdated > 0 && <span className="nbp-meta">Uppdaterad {fmtShort(new Date(lastUpdated).toISOString())}</span>}
        </span>
        <svg className="nbp-chevron" width="14" height="14" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>

      <div className="nbp-body">
        {items.length === 0 && !isAdmin && <div className="nbp-empty">Inget aktuellt just nu</div>}
        {group('status', statusItems, item => (
          <>
            {rowTitle(item)}
            <span className="nbp-col-status"><span className={`nbp-status nbp-status--${item.status}`}>{STATUS_LABELS[item.status as Status]}</span></span>
          </>
        ))}
        {archiveLink('status')}
        {group('event', eventItems, item => (
          <>
            <span className="nbp-date">{fmtRange(item.eventDate!, item.eventEndDate)}</span>
            <span className="nbp-time">{item.startTime || ''}</span>
            {rowTitle(item)}
          </>
        ))}
        {group('info', infoItems, item => (
          <>
            {rowTitle(item)}
            <span className="nbp-col-status">{item.completedAt && <span className="nbp-status nbp-status--klar">Klar</span>}</span>
          </>
        ))}
        {archiveLink('info')}
      </div>

      {createPortal(<>
      {showArchive && (
        <div className="nbm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setShowArchive(null) }}>
          <div className="nbm nbm--klar" onClick={e => e.stopPropagation()}>
            <div className="nbm-hero">
              <button className="nbm-close" onClick={() => setShowArchive(null)} aria-label="Stäng">×</button>
              <div className="nbm-kicker">{SECTION_TITLES[showArchive]}</div>
              <h2 className="nbm-title">Arkiv</h2>
            </div>
            <div className="nba-list">
              {archivedItems.map(item => (
                <button key={item.id} className="nba-row" onClick={() => openItem(item)}>
                  <span className="nba-title">{item.title}</span>
                  <span className="nba-date">Klar {fmtShort(item.completedAt!)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {viewing && (
        <div className="nbm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setViewing(null) }}>
          <div className={`nbm nbm--${viewing.section}${viewing.status ? ` nbm--${viewing.status}` : ''}`} onClick={e => e.stopPropagation()}>
            <div className="nbm-hero">
              <button className="nbm-close" onClick={() => setViewing(null)} aria-label="Stäng">×</button>
              <div className="nbm-kicker">{SECTION_TITLES[viewing.section]}</div>
              <h2 className="nbm-title">{viewing.title}</h2>
              <div className="nbm-chips">
                {viewing.status && <span className={`nbm-chip nbm-chip--status nbm-chip--${viewing.status}`}>{STATUS_LABELS[viewing.status]}{viewing.status === 'klar' && viewing.completedAt ? ` ${fmtShort(viewing.completedAt)}` : ''}</span>}
                {viewing.section === 'info' && viewing.completedAt && <span className="nbm-chip nbm-chip--status nbm-chip--klar">Klar {fmtShort(viewing.completedAt)}</span>}
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
            <FileList files={viewing.attachments} />
            <SignBox key={`item-${viewing.id}`} signatures={viewing.signatures} onSign={signAs(`/api/newsletter/${viewing.id}/sign`, viewing.id)} />

            {/* Uppdateringar – direkt i anslutning till huvudinlägget, senaste först */}
            {((viewing.updates || []).length > 0 || isAdmin || updEdit) && (
              <div className="nbu">
                <div className="nbu-head">
                  <span>Uppdateringar{(viewing.updates || []).length > 0 ? ` (${viewing.updates.length})` : ''}</span>
                  {isAdmin && !updEdit && (
                    <button className="nbu-add" onClick={() => { setUpdError(null); setUpdEdit({ id: null, body: '', attachments: [] }) }}>+ Lägg till uppdatering</button>
                  )}
                </div>

                {updEdit && (
                  <div className="nbu-card nbu-card--edit">
                    {updError && <div className="nb-error">{updError}</div>}
                    <RichTextEditor key={updEdit.id ?? 'new'} ref={updEditorRef} initialValue={updEdit.body} />
                    <input ref={updFileRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleUpdateFiles(e.target.files)} />
                    <div className="attachment-upload-area">
                      <button type="button" className="attachment-upload-btn" onClick={() => updFileRef.current?.click()} disabled={updUploading}>
                        {updUploading ? 'Laddar upp...' : '+ Ladda upp fil'}
                      </button>
                      {updEdit.attachments.length > 0 && (
                        <div className="attachments-list">
                          {updEdit.attachments.map((a, idx) => (
                            <div key={`${a.url}-${idx}`} className="attachment-item">
                              <a href={a.url} target="_blank" rel="noreferrer" className="attachment-link">{a.originalName}</a>
                              <button type="button" className="attachment-remove" title="Ta bort fil"
                                onClick={() => setUpdEdit(prev => prev && { ...prev, body: updEditorRef.current?.getValue() ?? prev.body, attachments: prev.attachments.filter((_, i) => i !== idx) })}>
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="nbm-actions nbu-edit-actions">
                      <button className="nbm-btn nbm-btn--ghost" onClick={() => setUpdEdit(null)}>Avbryt</button>
                      <button className="nbm-btn nbm-btn--primary" onClick={saveUpdate} disabled={updSaving}>{updSaving ? 'Sparar...' : 'Spara uppdatering'}</button>
                    </div>
                  </div>
                )}

                {[...(viewing.updates || [])].reverse().map((u, idx) => (
                  <div key={u.id} className={`nbu-card${idx === 0 ? ' nbu-card--latest' : ''}`}>
                    <div className="nbu-meta">
                      {idx === 0 && <span className="nbu-latest">Senaste</span>}
                      <span>Uppdatering {fmtDateTime(u.createdAt)}</span>
                      {isAdmin && (
                        <span className="nbu-admin">
                          <button className="nb-link-btn" onClick={() => {
                            setUpdError(null)
                            setUpdEdit({ id: u.id, body: u.body, attachments: u.attachments || [] })
                          }}>Redigera</button>
                          <button className="nb-link-btn nb-link-btn--danger" onClick={() => setDeleteUpdate(u)}>Ta bort</button>
                        </span>
                      )}
                    </div>
                    {u.body && (looksLikeHtml(u.body)
                      ? <div className="log-message nbu-body" dangerouslySetInnerHTML={{ __html: u.body }} />
                      : <div className="nbm-text nbu-body">{u.body}</div>)}
                    <FileList files={u.attachments} />
                    <SignBox key={`upd-${u.id}`} signatures={u.signatures} onSign={signAs(`/api/newsletter/updates/${u.id}/sign`, viewing.id)} />
                  </div>
                ))}
              </div>
            )}
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

              {edit.section === 'info' && (
                <label className="nb-check">
                  <input type="checkbox" checked={edit.done} onChange={e => setEdit({ ...edit, done: e.target.checked })} />
                  Klar
                </label>
              )}
              <label className="nb-label">{edit.section === 'status' ? 'Kommentar' : edit.section === 'event' ? 'Information' : 'Text'}</label>
              <RichTextEditor ref={editorRef} initialValue={edit.body} />

              {edit.section !== 'event' && (
                <>
                  <label className="nb-label">Filer</label>
                  <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
                  <div className="attachment-upload-area">
                    <button type="button" className="attachment-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      {uploading ? 'Laddar upp...' : '+ Ladda upp fil'}
                    </button>
                    {edit.attachments.length > 0 && (
                      <div className="attachments-list">
                        {edit.attachments.map((a, idx) => (
                          <div key={`${a.url}-${idx}`} className="attachment-item">
                            <a href={a.url} target="_blank" rel="noreferrer" className="attachment-link">{a.originalName}</a>
                            <button type="button" className="attachment-remove" title="Ta bort fil"
                              onClick={() => setEdit(prev => prev && { ...prev, body: editorRef.current?.getValue() ?? prev.body, attachments: prev.attachments.filter((_, i) => i !== idx) })}>
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="nb-form-actions">
                <button className="confirm-btn confirm-btn--secondary" onClick={() => setEdit(null)}>Avbryt</button>
                <button className="confirm-btn confirm-btn--primary" onClick={save} disabled={saving}>{saving ? 'Sparar...' : 'Spara'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteUpdate && (
        <ConfirmModal
          title="Ta bort uppdatering"
          message={`Ta bort uppdateringen från ${fmtDateTime(deleteUpdate.createdAt)}?`}
          confirmText="Ta bort"
          cancelText="Avbryt"
          onConfirm={confirmDeleteUpdate}
          onCancel={() => setDeleteUpdate(null)}
        />
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
