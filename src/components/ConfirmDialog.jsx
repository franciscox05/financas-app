import { useEffect, useId, useRef } from 'react'

// Diálogo de confirmação modal (usa <dialog> nativo: foco preso, Esc fecha,
// aria-modal implícito). Ação destrutiva destacada a vermelho.
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancel()
      }}
      aria-labelledby={titleId}
      className="confirm-dialog m-auto w-[calc(100%-2rem)] max-w-xs rounded-2xl bg-white p-5 text-neutral-900 shadow-xl backdrop:bg-black/50 dark:bg-neutral-800 dark:text-neutral-100"
    >
      <h2 id={titleId} className="text-base font-semibold tracking-tight">
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
          className="min-h-11 flex-1 rounded-xl border border-neutral-300 px-3 text-sm font-medium active:scale-[0.97] dark:border-neutral-600"
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
    </dialog>
  )
}
