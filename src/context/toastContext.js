import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

// Devolve { success(msg), error(msg), info(msg) }. Falha cedo fora do provider.
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
