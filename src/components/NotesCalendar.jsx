import { Pencil, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '../context/toastContext'
import { createNote, deleteNote, listNotes, updateNote } from '../lib/profileDb'
import { monthKey, monthStart, today } from '../lib/dates'
import { shortDate } from '../lib/format'
import ConfirmDialog from './ConfirmDialog'
import { EmptyState } from './Feedback'
import Modal from './Modal'
import MonthPicker from './MonthPicker'

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'
const inputClass = `w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Uma nota existente, com edição em linha (mesmo padrão já usado no nome de
// um amigo/perfil) e apagar.
function NoteRow({ note, onSaved, onDeleteRequest }) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSave(e) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const updated = await updateNote(note.id, draft)
      onSaved(updated)
      setEditing(false)
      toast.success('Nota atualizada.')
    } catch (err) {
      setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <textarea
          autoFocus
          rows={3}
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
            disabled={busy || !draft.trim()}
            className={`min-h-9 rounded-lg bg-neutral-900 px-3 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
          >
            {busy ? 'A guardar...' : 'Guardar'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setDraft(note.body)
              setEditing(false)
            }}
            className={`min-h-9 rounded-lg border border-neutral-300 px-3 text-sm dark:border-neutral-700 ${focusRing}`}
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <li className="flex items-start gap-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-neutral-800 dark:text-neutral-200">{note.body}</p>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar nota"
          className={`flex size-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 ${focusRing}`}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteRequest(note)}
          aria-label="Apagar nota"
          className={`flex size-9 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-red-600 ${focusRing}`}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  )
}

// Notas em formato de calendário: cada dia com notas leva um ponto por baixo
// do número (mesma lógica visual de grelha do MonthCalendar.jsx do Balanço,
// adaptada — aqui a célula só precisa de um indicador, não de um valor em
// euros). Clicar num dia abre as notas desse dia para ler/editar/apagar; o
// composer de nova nota só aparece no dia de hoje, porque createNote() usa
// sempre a data real de criação (como em todo o resto da app, created_at
// nunca é escolhido à mão pelo utilizador).
export default function NotesCalendar() {
  const toast = useToast()
  const [selectedMonth, setSelectedMonth] = useState(() => monthStart(new Date()))
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [newBody, setNewBody] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    listNotes()
      .then((data) => {
        if (mounted.current) setNotes(data)
      })
      .catch((err) => {
        if (mounted.current) setError(err.message || 'Não foi possível carregar as notas.')
      })
      .finally(() => {
        if (mounted.current) setLoading(false)
      })
  }, [])

  const todayIso = today()
  const isCurrentMonth = monthKey(selectedMonth) === monthKey(monthStart(new Date()))
  const todayDay = Number(todayIso.slice(8, 10))

  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()
  const firstWeekday = (new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay() + 6) % 7

  const byDay = useMemo(() => {
    const map = new Map()
    for (const note of notes) {
      const iso = note.created_at.slice(0, 10)
      if (iso.slice(0, 7) !== monthKey(selectedMonth)) continue
      const day = Number(iso.slice(8, 10))
      if (!map.has(day)) map.set(day, [])
      map.get(day).push(note)
    }
    return map
  }, [notes, selectedMonth])

  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const dayNotes = selectedDay ? (byDay.get(selectedDay) ?? []) : []
  const isSelectedToday = isCurrentMonth && selectedDay === todayDay

  function openDay(day) {
    setSelectedDay(day)
    setNewBody('')
    setAddError('')
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (adding) return
    setAdding(true)
    setAddError('')
    try {
      const created = await createNote(newBody)
      if (!mounted.current) return
      setNotes((prev) => [created, ...prev])
      setNewBody('')
      toast.success('Nota guardada.')
    } catch (err) {
      setAddError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setAdding(false)
    }
  }

  function handleNoteSaved(updated) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
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

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
  }

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  }

  return (
    <div className="space-y-3">
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-neutral-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />
          const hasNotes = byDay.has(day)
          const isToday = isCurrentMonth && day === todayDay
          return (
            <button
              key={day}
              type="button"
              onClick={() => openDay(day)}
              aria-current={isToday ? 'date' : undefined}
              aria-label={hasNotes ? `Dia ${day}, com notas` : `Dia ${day}`}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs transition-colors ${
                isToday ? 'ring-2 ring-blue-500 ring-inset' : ''
              } ${
                hasNotes
                  ? 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700'
                  : 'text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-900'
              }`}
            >
              <span className={isToday ? 'font-bold text-neutral-900 dark:text-white' : undefined}>{day}</span>
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${hasNotes ? 'bg-blue-500' : 'bg-transparent'}`}
              />
            </button>
          )
        })}
      </div>

      {notes.length === 0 && <EmptyState title="Ainda sem notas" description="Escreve a primeira no dia de hoje." />}

      <Modal open={selectedDay !== null} onClose={() => setSelectedDay(null)} labelledBy="notes-day-title">
        <h2 id="notes-day-title" className="mb-3 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {selectedDay &&
            shortDate(
              `${monthKey(selectedMonth)}-${String(selectedDay).padStart(2, '0')}`,
              { withYear: true },
            )}
        </h2>

        {dayNotes.length === 0 ? (
          <p className="py-1 text-sm text-neutral-400">Sem notas neste dia.</p>
        ) : (
          <ul className="space-y-2">
            {dayNotes.map((note) => (
              <NoteRow key={note.id} note={note} onSaved={handleNoteSaved} onDeleteRequest={setDeleteTarget} />
            ))}
          </ul>
        )}

        {isSelectedToday && (
          <form onSubmit={handleAdd} className="mt-3 space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
            <label htmlFor="new-note-body" className="sr-only">
              Nova nota
            </label>
            <textarea
              id="new-note-body"
              rows={3}
              placeholder="Escreve uma nota..."
              value={newBody}
              disabled={adding}
              onChange={(e) => setNewBody(e.target.value)}
              className={inputClass}
            />
            {addError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {addError}
              </p>
            )}
            <button
              type="submit"
              disabled={adding || !newBody.trim()}
              className={`min-h-11 w-full rounded-lg bg-neutral-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
            >
              {adding ? 'A guardar...' : 'Guardar nota'}
            </button>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Apagar nota?"
        confirmLabel="Apagar nota"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
