import { createContext, useContext } from 'react'

export const PrivacyContext = createContext({ hidden: false, toggle: () => {} })

// Devolve { hidden, toggle }. Quando `hidden` é true, os montantes aparecem
// desfocados (ver <Money />). Sem provider, nada é escondido.
export function usePrivacy() {
  return useContext(PrivacyContext)
}
