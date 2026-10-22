import { Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { EmptyState } from './Feedback'
import { useToast } from '../context/toastContext'
import { shortDate } from '../lib/format'
import { createNote, deleteNote, listNotes } from '../lib/profileDb'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const inputClass = `w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Notas pessoais em texto livre — um bloco de notas simples, sem título,
// tags nem pastas: só escrever e guardar.
export default function NotesSection() {
  const toast = useToast()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [body, setBody] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  async function load() {
    setError('')
    try {
      const data = await listNotes()
      if (mounted.current) setNotes(data)
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível carregar as notas.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (adding) return
    setAdding(true)
    setError('')
    try {
      const created = await createNote(body)
      if (!mounted.current) return
      setNotes((prev) => [created, ...prev])
      setBody('')
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setAdding(false)
    }
  }

  async function handleDelete() {
    const note = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteNote(note.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
      toast.success('Nota apagada.')
    } catch (err) {
      toast.error(err.message || 'Não foi possível apagar. Tenta outra vez.')
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-500">Notas</h2>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <label htmlFor="note-body" className="sr-only">
          Nova nota
        </label>
        <textarea
          id="note-body"
          rows={3}
          placeholder="Escreve uma nota..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={adding || !body.trim()}
          className={`min-h-11 w-full rounded-lg bg-neutral-900 text-sm font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
        >
          {adding ? 'A guardar...' : 'Guardar nota'}
        </button>
      </form>

      {!loading && notes.length === 0 ? (
        <EmptyState title="Ainda sem notas" description="Escreve a primeira acima." />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li
              key={note.id}
              className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{note.body}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {shortDate(note.created_at.slice(0, 10), { withYear: true })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(note)}
                aria-label="Apagar nota"
                className={`flex size-11 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors duration-150 ease-out hover:text-red-600 active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar nota?"
        confirmLabel="Apagar nota"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}
