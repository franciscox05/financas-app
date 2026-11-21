import { t } from '../i18n'
import { useId } from 'react'
import Modal from './Modal'
import { dangerButton, secondaryButton } from './ui/styles'

// Diálogo de confirmação. Ação destrutiva destacada a vermelho.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()

  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId}>
      <h2 id={titleId} className="text-[1.25rem] leading-tight font-bold tracking-tight text-label">
        {title}
      </h2>
      {message && (
        <p className="mt-2 text-[0.9375rem] leading-snug text-label-2">
          {message}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={`${secondaryButton} flex-1`}
        >
          {cancelLabel ?? t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`${dangerButton} flex-1`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
