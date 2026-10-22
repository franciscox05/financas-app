import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/toastContext'
import { getFullName, updateFullName } from '../lib/profileDb'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const inputClass = `min-h-11 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out disabled:opacity-50 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Iniciais para o avatar: 2 primeiras palavras do nome, ou a primeira letra do email.
function initials(name, email) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

// Cabeçalho do Perfil: avatar (iniciais), nome editável (mesmo padrão de
// edição em linha usado no nome de um amigo) e email (da conta, não editável
// aqui).
export default function PersonalInfoSection() {
  const { user } = useAuth()
  const toast = useToast()
  const [value, setValue] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
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
      await updateFullName(draft)
      if (mounted.current) {
        setValue(draft)
        setEditing(false)
        toast.success('Nome guardado.')
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <section className="flex items-center gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div
        aria-hidden="true"
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        {initials(value, user?.email)}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-2">
            <input
              type="text"
              autoFocus
              autoComplete="name"
              placeholder="O teu nome"
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
            />
            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className={`min-h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
              >
                {busy ? 'A guardar...' : 'Guardar'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setEditing(false)}
                className={`min-h-9 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700 ${focusRing}`}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-1">
            <h2 className="min-w-0 truncate text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {loaded ? value || 'Sem nome' : '...'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setDraft(value)
                setError('')
                setEditing(true)
              }}
              aria-label="Editar nome"
              disabled={!loaded}
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors duration-150 ease-out hover:text-neutral-900 disabled:opacity-40 motion-reduce:transition-none dark:hover:text-neutral-100 ${focusRing}`}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        {!editing && <p className="truncate text-sm text-neutral-500">{user?.email}</p>}
      </div>
    </section>
  )
}
