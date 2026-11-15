import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { getMyPhone, saveMyPhone } from '../lib/friendsDb'
import { focusRing } from './ui/styles'

// O número do perfil: é com ele que os amigos encontram esta conta.
export default function MyPhoneSection() {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    getMyPhone()
      .then((phone) => {
        if (mounted.current) setValue(phone ?? '')
      })
      .catch((err) => {
        if (mounted.current) setError(err.message || 'Não foi possível carregar o número.')
      })
      .finally(() => {
        if (mounted.current) setLoaded(true)
      })
    return () => {
      mounted.current = false
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await saveMyPhone(value)
      if (mounted.current) {
        toast.success(value.trim() === '' ? 'Número removido.' : 'Número guardado.')
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar o número. Tenta outra vez.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="my-phone" className="block text-xs font-medium text-label-2">
          O meu número de telemóvel (opcional)
        </label>
        <p id="my-phone-hint" className="text-xs text-label-2">
          É com este número que os teus amigos te encontram na app. Só tu o vês.
        </p>
        <div className="flex gap-2">
          <input
            id="my-phone"
            aria-describedby="my-phone-hint"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="Ex: 912 345 678"
            value={value}
            disabled={!loaded || busy}
            onChange={(e) => setValue(e.target.value)}
            className={`min-h-11 min-w-0 flex-1 rounded-control border-0 bg-fill px-3.5 text-label focus:ring-2 focus:ring-accent transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none ${focusRing}`}
          />
          <button
            type="submit"
            disabled={busy || !loaded}
            className={`min-h-11 rounded-control bg-accent-fill px-4 text-sm font-medium text-white transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
          >
            {busy ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
      </form>
    </div>
  )
}
