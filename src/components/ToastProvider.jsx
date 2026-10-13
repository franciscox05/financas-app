import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToastContext } from '../context/toastContext'

const DURATION_MS = { success: 3000, info: 3500, error: 5500 }
// Toasts com uma ação (ex. "Desfazer") ficam mais tempo visíveis — a pessoa
// precisa de tempo para ler e decidir, não só para ler a confirmação.
const ACTION_DURATION_MS = 8000
const MAX_VISIBLE = 3
// Tem de acompanhar a duração de .toast-out em index.css.
const EXIT_MS = 160

const DOT_CLASS = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
}

function ToastItem({ toast, onDismiss }) {
  const duration = toast.action ? ACTION_DURATION_MS : DURATION_MS[toast.kind]

  // `stamp` muda quando o mesmo aviso é repetido: o relógio recomeça em vez de
  // empilhar um toast igual.
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.stamp, duration, onDismiss])

  return (
    <li
      className={`${toast.leaving ? 'toast-out' : 'toast-in'} pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-neutral-900/95 px-3.5 py-2.5 text-[13px] leading-snug text-neutral-50 shadow-lg ring-1 ring-black/10 backdrop-blur dark:bg-neutral-800/95 dark:ring-white/10`}
    >
      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${DOT_CLASS[toast.kind]}`} />
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick()
            onDismiss(toast.id)
          }}
          className="shrink-0 font-semibold underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Fechar notificação"
        className="shrink-0 px-1 opacity-50 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </li>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  // Marca como "a sair" para dar tempo à animação, e só depois remove.
  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, EXIT_MS)
  }, [])

  const push = useCallback((kind, message, { action } = {}) => {
    setToasts((prev) => {
      // Mesmo aviso já visível (ex. vários toques seguidos no sino): não
      // duplica, só renova o tempo de vida.
      const existing = prev.find((t) => !t.leaving && !action && !t.action && t.kind === kind && t.message === message)
      if (existing) {
        return prev.map((t) => (t.id === existing.id ? { ...t, stamp: t.stamp + 1 } : t))
      }
      const id = nextId.current++
      // Mantém no máximo MAX_VISIBLE; os mais antigos saem primeiro.
      return [...prev, { id, kind, message, action, stamp: 0 }].slice(-MAX_VISIBLE)
    })
  }, [])

  const api = useMemo(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      info: (message, opts) => push('info', message, opts),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* aria-live: leitores de ecrã anunciam sem roubar o foco. Fica acima da
          barra de navegação (≈4.5rem) para nunca a tapar. */}
      <ul
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md flex-col gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </ul>
    </ToastContext.Provider>
  )
}
