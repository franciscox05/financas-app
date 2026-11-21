import { t } from '../i18n'
import { ListFilter, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import CollapsibleSection from './CollapsibleSection'
import { useToast } from '../context/toastContext'
import { createCategoryRule, deleteCategoryRule, listCategoryRules } from '../lib/db'
import { EmptyState } from './Feedback'

// Dicionario de palavra-chave -> categoria, usado pelo importador para
// categorizar automaticamente notas parecidas em meses diferentes (ex.
// "gas" apanha "gasolina" e "gasóleo" sem ter de repetir a escolha).
export default function CategoryRulesSection({ categories }) {
  const toast = useToast()
  const [showSection, setShowSection] = useState(false)
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      setRules(await listCategoryRules())
    } catch (err) {
      toast.error(t('rules.loadFailed', { msg: err.message }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (showSection) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSection])

  async function handleCreate(e) {
    e.preventDefault()
    if (!keyword.trim()) {
      setError(t('rules.err.keyword'))
      return
    }
    if (!categoryId) {
      setError(t('rules.err.category'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createCategoryRule({ keyword: keyword.trim(), categoryId })
      setKeyword('')
      setShowForm(false)
      await load()
      toast.success(t('rules.created'))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(rule) {
    try {
      await deleteCategoryRule(rule.id)
      setConfirmingDeleteId(null)
      await load()
      toast.success(t('rules.deleted'), {
        action: {
          label: t('common.undo'),
          onClick: async () => {
            try {
              await createCategoryRule({ keyword: rule.keyword, categoryId: rule.category_id })
              await load()
              toast.success(t('rules.restored'))
            } catch (err) {
              toast.error(t('common.undoFailed', { msg: err.message }))
            }
          },
        },
      })
    } catch (err) {
      toast.error(t('common.deleteFailed', { msg: err.message }))
    }
  }

  return (
    <CollapsibleSection
      title={t('rules.title')}
      icon={ListFilter}
      description={t('rules.desc')}
      open={showSection}
      onToggle={() => setShowSection((v) => !v)}
    >
          {loading ? (
            <p className="text-sm text-label-2">{t('common.loadingDots')}</p>
          ) : rules.length === 0 && !showForm ? (
            <EmptyState
              title={t('rules.empty')}
              description={t('rules.emptyBody')}
              actionLabel={t('rules.newPlus')}
              onAction={() => setShowForm(true)}
            />
          ) : (
            <ul className="divide-y divide-separator">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-label">
                    "{r.keyword}" → {r.categories?.name}
                  </span>
                  {confirmingDeleteId === r.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(r)}
                        className="rounded bg-negative px-2 py-1 text-xs font-medium text-white"
                      >
                        {t('rules.confirm')}
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded border border-separator px-2 py-1 text-xs"
                      >
                        {t('common.cancel')}
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDeleteId(r.id)}
                      aria-label={t('rules.deleteRule', { keyword: r.keyword })}
                      className="rounded p-1 text-label-3 hover:text-negative"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {rules.length > 0 && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-0.5 text-xs text-label-2 underline-offset-2 hover:underline"
            >
              <Plus size={13} /> {t('rules.new')}
            </button>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="space-y-2 rounded-control border border-separator p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-label-2">{t('rules.keyword')}</label>
                  <input
                    type="text"
                    placeholder='Ex: "gas"'
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-label-2">{t('common.category')}</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-control border-0 bg-fill px-3 text-label focus:ring-2 focus:ring-accent"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'income' ? t('kind.income') : t('kind.expense')})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-negative">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 min-h-11 rounded-control bg-accent-fill px-4 text-[0.9375rem] font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? t('common.saving') : t('rules.save')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="min-h-11 rounded-control bg-fill px-4 text-[0.9375rem] font-semibold text-label"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          )}
    </CollapsibleSection>
  )
}
