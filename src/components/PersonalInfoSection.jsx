import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { getFullName, updateFullName } from '../lib/profileDb'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const inputClass = `min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Nome (editável) e email (vem da conta, não editável aqui).
export default function PersonalInfoSection() {
  const { user } = useAuth()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    getFullName()
      .then((name) => {
        if (mounted.current) setValue(name)
      })
      .catch((err) => {
        if (mounted.current) setError(err.message || 'Não foi possível carregar o nome.')
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
      await updateFullName(value)
      if (mounted.current) toast.success('Nome guardado.')
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-500">Dados pessoais</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <label htmlFor="profile-name" className="block text-xs font-medium text-neutral-500">
          Nome
        </label>
        <div className="flex gap-2">
          <input
            id="profile-name"
            type="text"
            autoComplete="name"
            value={value}
            disabled={!loaded || busy}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
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

      <div>
        <p className="block text-xs font-medium text-neutral-500">Email</p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">{user?.email}</p>
      </div>
    </section>
  )
}
