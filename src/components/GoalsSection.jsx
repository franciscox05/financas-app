import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { EmptyState } from './Feedback'
import OptionalDateField from './OptionalDateField'
import { useToast } from '../context/toastContext'
import { shortDate } from '../lib/format'
import { createGoal, deleteGoal, listGoals, toggleGoalDone } from '../lib/profileDb'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const inputClass = `min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm transition-colors duration-150 ease-out dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 ${focusRing}`

// Objetivos pessoais em texto livre, com prazo opcional — sem ligação a
// dinheiro (ao contrário da antiga feature de metas de poupança, removida).
export default function GoalsSection() {
  const toast = useToast()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [dueOn, setDueOn] = useState('')
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
      const data = await listGoals()
      if (mounted.current) setGoals(data)
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível carregar os objetivos.')
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
      const created = await createGoal({ title, dueOn })
      if (!mounted.current) return
      setGoals((prev) => [created, ...prev])
      setTitle('')
      setDueOn('')
    } catch (err) {
      if (mounted.current) setError(err.message || 'Não foi possível guardar. Tenta outra vez.')
    } finally {
      if (mounted.current) setAdding(false)
    }
  }

  async function handleToggle(goal) {
    const previous = goals
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, done: !g.done } : g)))
    try {
      await toggleGoalDone(goal.id, !goal.done)
    } catch (err) {
      setGoals(previous)
      toast.error(err.message || 'Não foi possível atualizar. Tenta outra vez.')
    }
  }

  async function handleDelete() {
    const goal = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteGoal(goal.id)
      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
      toast.success('Objetivo apagado.')
    } catch (err) {
      toast.error(err.message || 'Não foi possível apagar. Tenta outra vez.')
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-neutral-500">Objetivos</h2>

      <form onSubmit={handleAdd} className="space-y-2 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
        <label htmlFor="goal-title" className="block text-xs font-medium text-neutral-500">
          Novo objetivo
        </label>
        <input
          id="goal-title"
          type="text"
          placeholder="Ex: Ler 12 livros este ano"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <OptionalDateField
          id="goal-due"
          label="Prazo (opcional)"
          addLabel="Definir prazo"
          value={dueOn}
          onChange={setDueOn}
          inputClass={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-neutral-900 text-sm font-medium text-white transition duration-150 ease-out hover:bg-neutral-700 active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 ${focusRing}`}
        >
          <Plus size={16} aria-hidden="true" /> {adding ? 'A guardar...' : 'Adicionar'}
        </button>
      </form>

      {!loading && goals.length === 0 ? (
        <EmptyState title="Ainda sem objetivos" description="Adiciona o primeiro acima." />
      ) : (
        <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
          {goals.map((goal) => (
            <li key={goal.id} className="flex min-h-12 items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={goal.done}
                onChange={() => handleToggle(goal)}
                aria-label={`Marcar "${goal.title}" como ${goal.done ? 'por fazer' : 'feito'}`}
                className="size-5 shrink-0 accent-neutral-900 dark:accent-neutral-100"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    goal.done
                      ? 'text-neutral-400 line-through dark:text-neutral-500'
                      : 'text-neutral-800 dark:text-neutral-200'
                  }`}
                >
                  {goal.title}
                </p>
                {goal.due_on && (
                  <p className="text-xs text-neutral-500">Prazo: {shortDate(goal.due_on, { withYear: true })}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(goal)}
                aria-label={`Apagar objetivo: ${goal.title}`}
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
        title="Apagar objetivo?"
        message={deleteTarget ? `"${deleteTarget.title}" deixa de aparecer na lista.` : ''}
        confirmLabel="Apagar objetivo"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </section>
  )
}
