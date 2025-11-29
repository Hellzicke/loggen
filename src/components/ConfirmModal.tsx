interface ConfirmModalProps {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ 
  title, 
  message, 
  confirmText = 'Ja',
  cancelText = 'Nej',
  onConfirm, 
  onCancel 
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="confirm-actions">
          <button className="confirm-btn confirm-btn--primary" onClick={onConfirm}>
            {confirmText}
          </button>
          <button className="confirm-btn confirm-btn--secondary" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  )
}

