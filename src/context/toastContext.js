import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

// Devolve { success(msg, opts?), error(msg, opts?), info(msg, opts?) }, onde
// opts = { action: { label, onClick } } mostra um botão extra no toast (ex.
// "Desfazer"). Falha cedo fora do provider.
export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de ToastProvider')
  return ctx
}
