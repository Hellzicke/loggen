import { useState } from 'react'
import EmployeeNameInput from './EmployeeNameInput'

// Guide för att lämna ett förslag: typ → beskrivning → namn → skicka
const KINDS = [
  {
    value: 'aktivitet',
    label: 'Aktivitet',
    hint: 'Något vi kan göra eller erbjuda',
    icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z" /></svg>,
  },
  {
    value: 'investering',
    label: 'Investering',
    hint: 'Inköp över 20 000 kr',
    icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /><path d="M6 10v5M18 10v5" /></svg>,
  },
  {
    value: 'rutin',
    label: 'Arbetsrutin',
    hint: 'Ändra eller införa ett arbetssätt',
    icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>,
  },
  {
    value: 'övrigt',
    label: 'Övrigt',
    hint: 'Allt annat du vill föreslå',
    icon: <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 12h.01M12 12h.01M16 12h.01" /></svg>,
  },
] as const

type Kind = typeof KINDS[number]['value']

const STEPS = ['Typ', 'Beskrivning', 'Namn']

interface Props {
  onSubmit: (title: string, description: string, author: string, category: string) => Promise<boolean>
  onClose: () => void
}

export default function SuggestionWizard({ onSubmit, onClose }: Props) {
  const [step, setStep] = useState(1)
  const [kind, setKind] = useState<Kind | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [cost, setCost] = useState('')
  const [author, setAuthor] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selected = KINDS.find(k => k.value === kind)
  const canContinue = title.trim() !== '' && description.trim() !== ''

  const submit = async () => {
    if (!kind || !author.trim()) return
    setSubmitting(true)
    setError('')
    const fullDescription = kind === 'investering' && cost.trim()
      ? `${description.trim()}\n\nUngefärlig kostnad: ${cost.trim()} kr`
      : description.trim()
    const ok = await onSubmit(title.trim(), fullDescription, author.trim(), kind)
    setSubmitting(false)
    if (ok) onClose()
    else setError('Förslaget kunde inte skickas. Försök igen.')
  }

  return (
    <div className="sw">
      <div className="sw-top">
        <div className="sw-steps">
          {STEPS.map((label, i) => (
            <div key={label} className={`sw-step${step === i + 1 ? ' sw-step--active' : ''}${step > i + 1 ? ' sw-step--done' : ''}`}>
              <span className="sw-step-dot">{step > i + 1 ? '✓' : i + 1}</span>
              <span className="sw-step-label">{label}</span>
            </div>
          ))}
        </div>
        <button className="sw-close" onClick={onClose} aria-label="Avbryt">×</button>
      </div>

      {step === 1 && (
        <>
          <h2 className="sw-title">Vad gäller ditt förslag?</h2>
          <div className="sw-kinds">
            {KINDS.map(k => (
              <button
                key={k.value}
                className={`sw-kind sw-kind--${k.value}${kind === k.value ? ' sw-kind--selected' : ''}`}
                onClick={() => { setKind(k.value); setStep(2) }}
              >
                <span className="sw-kind-icon">{k.icon}</span>
                <span className="sw-kind-label">{k.label}</span>
                <span className="sw-kind-hint">{k.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && selected && (
        <>
          <h2 className="sw-title">Beskriv ditt förslag</h2>
          <div className="sw-chosen"><span className="sw-chosen-icon">{selected.icon}</span>{selected.label}</div>
          <label className="sw-label">Rubrik</label>
          <input className="sw-input" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
          <label className="sw-label">Beskrivning</label>
          <textarea className="sw-input sw-textarea" rows={5} value={description} onChange={e => setDescription(e.target.value)} />
          {kind === 'investering' && (
            <>
              <label className="sw-label">Ungefärlig kostnad (kr)</label>
              <input className="sw-input sw-input--short" inputMode="numeric" value={cost} onChange={e => setCost(e.target.value)} />
            </>
          )}
          <div className="sw-actions">
            <button className="sw-btn sw-btn--ghost" onClick={() => setStep(1)}>Tillbaka</button>
            <button className="sw-btn sw-btn--primary" onClick={() => setStep(3)} disabled={!canContinue}>Nästa</button>
          </div>
        </>
      )}

      {step === 3 && selected && (
        <>
          <h2 className="sw-title">Vem lämnar förslaget?</h2>
          <EmployeeNameInput value={author} onChange={setAuthor} selectClassName="sw-input" inputClassName="sw-input" autoFocus />
          <div className="sw-summary">
            <div className="sw-summary-kind"><span className="sw-chosen-icon">{selected.icon}</span>{selected.label}</div>
            <div className="sw-summary-title">{title}</div>
            <div className="sw-summary-text">{description}</div>
            {kind === 'investering' && cost.trim() && <div className="sw-summary-text">Ungefärlig kostnad: {cost.trim()} kr</div>}
          </div>
          {error && <div className="sw-error">{error}</div>}
          <div className="sw-actions">
            <button className="sw-btn sw-btn--ghost" onClick={() => setStep(2)}>Tillbaka</button>
            <button className="sw-btn sw-btn--primary" onClick={submit} disabled={submitting || !author.trim()}>
              {submitting ? 'Skickar...' : 'Skicka förslag'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
