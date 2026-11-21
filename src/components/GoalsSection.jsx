import { t } from '../i18n'
import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import ConfirmDialog from './ConfirmDialog'
import { EmptyState, Pager } from './Feedback'
import OptionalDateField from './OptionalDateField'
import { useToast } from '../context/toastContext'
import { shortDate } from '../lib/format'
import { createGoal, deleteGoal, listGoals, toggleGoalDone } from '../lib/profileDb'
import { focusRing, inputClass } from './ui/styles'

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
  const [page, setPage] = useState(1)
  const mounted = useRef(true)
  const PER_PAGE = 10

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
      if (mounted.current) setError(err.message || t('goals.loadFailed'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = Math.max(1, Math.ceil(goals.length / PER_PAGE))
  const pageItems = useMemo(() => goals.slice((page - 1) * PER_PAGE, page * PER_PAGE), [goals, page])

  // Mantém a página dentro dos limites depois de apagar (ex. última página ficou vazia).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  async function handleAdd(e) {
    e.preventDefault()
    if (adding) return
    setAdding(true)
    setError('')
    try {
      const created = await createGoal({ title, dueOn })
      if (!mounted.current) return
      setGoals((prev) => [created, ...prev])
      setPage(1)
      setTitle('')
      setDueOn('')
    } catch (err) {
      if (mounted.current) setError(err.message || t('sheet.saveRetry'))
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
      toast.error(err.message || t('goals.updateRetry'))
    }
  }

  async function handleDelete() {
    const goal = deleteTarget
    setDeleteTarget(null)
    try {
      await deleteGoal(goal.id)
      setGoals((prev) => prev.filter((g) => g.id !== goal.id))
      toast.success(t('goals.deleted'))
    } catch (err) {
      toast.error(err.message || t('common.deleteRetry'))
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleAdd} className="space-y-2 rounded-control border border-separator p-3">
        <label htmlFor="goal-title" className="block text-xs font-medium text-label-2">
          {t('goals.new')}
        </label>
        <input
          id="goal-title"
          type="text"
          placeholder={t('goals.placeholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />
        <OptionalDateField
          id="goal-due"
          label={t('goals.due')}
          addLabel={t('sheet.setDue')}
          value={dueOn}
          onChange={setDueOn}
          inputClass={inputClass}
        />
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={adding || !title.trim()}
          className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control bg-accent-fill text-sm font-medium text-white transition duration-150 ease-out active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          <Plus size={16} aria-hidden="true" /> {adding ? t('common.saving') : t('common.add')}
        </button>
      </form>

      {!loading && goals.length === 0 ? (
        <EmptyState title={t('goals.empty')} description={t('goals.emptyBody')} />
      ) : (
        <ul className="divide-y divide-separator">
          {pageItems.map((goal) => (
            <li key={goal.id} className="flex min-h-12 items-center gap-3 py-2">
              <input
                type="checkbox"
                checked={goal.done}
                onChange={() => handleToggle(goal)}
                aria-label={t(goal.done ? 'goals.markTodo' : 'goals.markDone', { title: goal.title })}
                className="size-5 shrink-0 accent-accent"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${
                    goal.done
                      ? 'text-label-3 line-through'
                      : 'text-label'
                  }`}
                >
                  {goal.title}
                </p>
                {goal.due_on && (
                  <p className="text-xs text-label-2">{t('goals.dueOn', { date: shortDate(goal.due_on, { withYear: true }) })}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(goal)}
                aria-label={t('goals.deleteGoal', { title: goal.title })}
                className={`flex size-11 shrink-0 items-center justify-center rounded-control text-label-3 transition-colors duration-150 ease-out hover:text-negative active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager page={page} totalPages={totalPages} onChange={setPage} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t('goals.deleteQ')}
        message={deleteTarget ? t('goals.deleteMsg', { title: deleteTarget.title }) : ''}
        confirmLabel={t('goals.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
