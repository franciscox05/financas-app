import { useEffect, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { getMyMbwayPhone, saveMbwayPhone } from '../lib/friendsDb'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

// O número que aparece nos lembretes de WhatsApp/SMS para os amigos pagarem por MB Way.
export default function MbwayPhoneSection() {
  const toast = useToast()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    getMyMbwayPhone()
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
      await saveMbwayPhone(value)
      if (mounted.current) {
        toast.success(value.trim() === '' ? 'Número MB Way removido.' : 'Número MB Way guardado.')
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar o número. Tenta outra vez.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-500">O meu MB Way</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="my-mbway" className="block text-xs font-medium text-neutral-500">
          O meu número MB Way (opcional)
        </label>
        <p className="text-xs text-neutral-500">Aparece nos lembretes que envias aos amigos.</p>
        <div className="flex gap-2">
          <input
            id="my-mbway"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="Ex: 912 345 678"
            value={value}
            disabled={!loaded || busy}
            onChange={(e) => setValue(e.target.value)}
            className={`min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`}
          />
          <button
            type="submit"
            disabled={busy || !loaded}
            className={`min-h-11 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
          >
            {busy ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
