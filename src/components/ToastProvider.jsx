import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from '../context/toastContext'

const DURATION_MS = { success: 3500, info: 3500, error: 6000 }
const MAX_VISIBLE = 3

const DOT_CLASS = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
}

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), DURATION_MS[toast.kind])
    return () => clearTimeout(timer)
  }, [toast.id, toast.kind, onDismiss])

  return (
    <li className="toast-in pointer-events-auto flex items-start gap-3 rounded-xl bg-neutral-900 px-4 py-3 text-sm text-neutral-50 shadow-lg ring-1 ring-black/10 dark:bg-neutral-100 dark:text-neutral-900">
      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${DOT_CLASS[toast.kind]}`} />
      <span className="min-w-0 flex-1">{toast.message}</span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fechar notificação"
        className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </li>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((kind, message) => {
    const id = nextId.current++
    // Mantém no máximo MAX_VISIBLE; os mais antigos saem primeiro.
    setToasts((prev) => [...prev, { id, kind, message }].slice(-MAX_VISIBLE))
  }, [])

  const api = useMemo(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live: leitores de ecrã anunciam sem roubar o foco. */}
      <ul
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </ul>
    </ToastContext.Provider>
  )
}
