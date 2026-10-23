import { useId } from 'react'
import Modal from './Modal'

// Diálogo de confirmação. Ação destrutiva destacada a vermelho.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  const titleId = useId()

  return (
    <Modal open={open} onClose={onCancel} labelledBy={titleId}>
      <h2 id={titleId} className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      {message && (
        <p className="mt-1.5 text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
          {message}
        </p>
      )}
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-3 text-sm font-medium text-neutral-900 active:scale-[0.97] dark:border-neutral-600 dark:text-neutral-100"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 flex-1 rounded-xl bg-red-600 px-3 text-sm font-medium text-white active:scale-[0.97]"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
