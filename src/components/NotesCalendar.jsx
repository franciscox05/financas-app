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
import { focusRing, inputClass } from './ui/styles'

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

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
      <form onSubmit={handleSave} className="space-y-2 rounded-control border border-separator p-3">
        <textarea
          autoFocus
          rows={3}
          value={draft}
          disabled={busy}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className={`min-h-9 rounded-control bg-accent-fill px-3 text-sm font-medium text-white disabled:opacity-50 ${focusRing}`}
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
            className={`min-h-9 rounded-control border border-separator px-3 text-sm ${focusRing}`}
          >
            Cancelar
          </button>
        </div>
      </form>
    )
  }

  return (
    <li className="flex items-start gap-2 rounded-control border border-separator p-3">
      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-label">{note.body}</p>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar nota"
          className={`flex size-9 items-center justify-center rounded-control text-label-3 transition-colors hover:text-label ${focusRing}`}
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteRequest(note)}
          aria-label="Apagar nota"
          className={`flex size-9 items-center justify-center rounded-control text-label-3 transition-colors hover:text-negative ${focusRing}`}
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
// euros). Clicar num dia abre as notas desse dia para ler, editar, apagar e
// escrever uma nova.
//
// Antes o composer só aparecia no dia de hoje, porque a tabela não tinha data
// de nota e o agrupamento usava `created_at` — qualquer outro dia ficava sem
// caixa de escrita. A coluna `noted_on` (migration 20261110010000) separa "o
// dia a que a nota se refere" de "quando foi escrita", e é por ela que se
// agrupa: deixa de haver dia só de leitura e resolve o desvio de fuso horário
// que punha uma nota escrita depois da meia-noite no dia anterior.
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
      const iso = note.noted_on ?? note.created_at.slice(0, 10)
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
  const selectedIso = selectedDay
    ? `${monthKey(selectedMonth)}-${String(selectedDay).padStart(2, '0')}`
    : null
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
      const created = await createNote(newBody, selectedIso)
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
    return <div className="h-64 animate-pulse rounded-control bg-fill" />
  }

  if (error) {
    return <p className="text-sm text-negative">{error}</p>
  }

  return (
    <div className="space-y-3">
      <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-label-3">
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
              className={`relative flex flex-col items-center justify-center gap-1 rounded-control py-2 text-xs transition-colors ${
                isToday ? 'ring-2 ring-accent ring-inset' : ''
              } ${
                hasNotes
                  ? 'bg-fill hover:bg-fill-strong'
                  : 'text-label-3 hover:bg-fill'
              }`}
            >
              <span className={isToday ? 'font-bold text-label dark:text-white' : undefined}>{day}</span>
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${hasNotes ? 'bg-accent-fill' : 'bg-transparent'}`}
              />
            </button>
          )
        })}
      </div>

      {notes.length === 0 && <EmptyState title="Ainda sem notas" description="Toca num dia para escrever a primeira." />}

      <Modal open={selectedDay !== null} onClose={() => setSelectedDay(null)} labelledBy="notes-day-title">
        <h2 id="notes-day-title" className="mb-3 text-base font-semibold tracking-tight text-label">
          {selectedIso && shortDate(selectedIso, { withYear: true })}
          {isSelectedToday && <span className="ml-2 text-xs font-normal text-label-3">hoje</span>}
        </h2>

        {dayNotes.length === 0 ? (
          <p className="py-1 text-sm text-label-3">Sem notas neste dia.</p>
        ) : (
          <ul className="space-y-2">
            {dayNotes.map((note) => (
              <NoteRow key={note.id} note={note} onSaved={handleNoteSaved} onDeleteRequest={setDeleteTarget} />
            ))}
          </ul>
        )}

        <form onSubmit={handleAdd} className="mt-3 space-y-2 rounded-control border border-separator p-3">
        <label htmlFor="new-note-body" className="sr-only">
          Nova nota
        </label>
        <textarea
          id="new-note-body"
          rows={3}
          placeholder={isSelectedToday ? 'Escreve uma nota...' : 'Escreve uma nota para este dia...'}
          value={newBody}
          disabled={adding}
          onChange={(e) => setNewBody(e.target.value)}
          className={inputClass}
        />
        {addError && (
          <p role="alert" className="text-sm text-negative">
            {addError}
          </p>
        )}
        <button
          type="submit"
          disabled={adding || !newBody.trim()}
          className={`min-h-11 w-full rounded-control bg-accent-fill text-sm font-medium text-white disabled:opacity-50 ${focusRing}`}
        >
          {adding ? 'A guardar...' : 'Guardar nota'}
        </button>
        </form>
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
