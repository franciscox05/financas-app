import { useCallback, useMemo, useState } from 'react'
import { PrivacyContext } from '../context/privacyContext'

const STORAGE_KEY = 'financasapp:privacy-hidden'

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export default function PrivacyProvider({ children }) {
  const [hidden, setHidden] = useState(readStored)

  const toggle = useCallback(() => {
    setHidden((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Sem localStorage (modo privado): o estado só dura enquanto a app está aberta.
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle])
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>
}
