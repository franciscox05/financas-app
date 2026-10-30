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
      toast.error(`Não foi possível carregar as regras: ${err.message}`)
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
      setError('Escreve uma palavra-chave.')
      return
    }
    if (!categoryId) {
      setError('Escolhe uma categoria.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await createCategoryRule({ keyword: keyword.trim(), categoryId })
      setKeyword('')
      setShowForm(false)
      await load()
      toast.success('Regra criada.')
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
      toast.success('Regra apagada.', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              await createCategoryRule({ keyword: rule.keyword, categoryId: rule.category_id })
              await load()
              toast.success('Regra restaurada.')
            } catch (err) {
              toast.error(`Não foi possível desfazer: ${err.message}`)
            }
          },
        },
      })
    } catch (err) {
      toast.error(`Não foi possível apagar: ${err.message}`)
    }
  }

  return (
    <CollapsibleSection
      title="Regras de categorização"
      icon={ListFilter}
      description='Associa uma palavra a uma categoria (ex. "gas" → Transporte). Aplica-se a qualquer nota que contenha essa palavra — "gasolina", "gasóleo" ou "gasolina bmw" caem todas na mesma categoria, mesmo escritas de forma diferente mês a mês. Usado automaticamente ao importar histórico — não recategoriza transações já existentes nem as registadas manualmente (usa "Corrigir categorias em massa" para essas).'
      open={showSection}
      onToggle={() => setShowSection((v) => !v)}
    >
          {loading ? (
            <p className="text-sm text-neutral-500">A carregar...</p>
          ) : rules.length === 0 && !showForm ? (
            <EmptyState
              title="Ainda sem regras"
              description='Cria a primeira, ex. "gas" → Transporte.'
              actionLabel="+ Nova regra"
              onAction={() => setShowForm(true)}
            />
          ) : (
            <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rules.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-neutral-700 dark:text-neutral-300">
                    "{r.keyword}" → {r.categories?.name}
                  </span>
                  {confirmingDeleteId === r.id ? (
                    <span className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(r)}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700"
                      >
                        Cancelar
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingDeleteId(r.id)}
                      aria-label={`Apagar regra ${r.keyword}`}
                      className="rounded p-1 text-neutral-400 hover:text-red-600"
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
              className="flex items-center gap-0.5 text-xs text-neutral-500 underline-offset-2 hover:underline"
            >
              <Plus size={13} /> Nova regra
            </button>
          )}

          {showForm && (
            <form onSubmit={handleCreate} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Palavra-chave</label>
                  <input
                    type="text"
                    placeholder='Ex: "gas"'
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-500">Categoria</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.type === 'income' ? 'Ganho' : 'Gasto'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-neutral-900 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {submitting ? 'A guardar...' : 'Guardar regra'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
    </CollapsibleSection>
  )
}
