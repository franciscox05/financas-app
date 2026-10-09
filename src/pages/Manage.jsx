import { useCallback, useEffect, useState } from 'react'
import EntityManager from '../components/EntityManager'
import { ErrorNotice, ListSkeleton } from '../components/Feedback'
import ImportSection from '../components/ImportSection'
import {
  createAccount,
  createCategory,
  deleteAccount,
  deleteCategory,
  listAccounts,
  listCategories,
  renameAccount,
  renameCategory,
  updateCategorySavingsFlag,
} from '../lib/db'

const ACCOUNT_GROUPS = [
  { type: 'cash', label: 'Contas à ordem' },
  { type: 'investment', label: 'Investimento' },
]

const CATEGORY_GROUPS = [
  { type: 'expense', label: 'Gastos' },
  { type: 'income', label: 'Ganhos' },
]

const byName = (a, b) => a.name.localeCompare(b.name, 'pt')

export default function Manage() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [accs, cats] = await Promise.all([listAccounts(), listCategories()])
      setAccounts(accs)
      setCategories(cats)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return <ListSkeleton rows={6} />
  }

  if (error) {
    return <ErrorNotice message={error} onRetry={load} />
  }

  return (
    <div className="space-y-8">
      <EntityManager
        title="Contas"
        noun="conta"
        items={accounts}
        groups={ACCOUNT_GROUPS}
        scope="all"
        onCreate={async (values) => {
          const created = await createAccount(values)
          setAccounts((prev) => [...prev, created].sort(byName))
        }}
        onRename={async (item, name) => {
          const updated = await renameAccount(item.id, name)
          setAccounts((prev) => prev.map((a) => (a.id === item.id ? updated : a)).sort(byName))
        }}
        onDelete={async (item) => {
          await deleteAccount(item.id)
          setAccounts((prev) => prev.filter((a) => a.id !== item.id))
        }}
      />

      <EntityManager
        title="Categorias"
        noun="categoria"
        items={categories}
        groups={CATEGORY_GROUPS}
        scope="group"
        deleteWarning="Os orçamentos definidos para esta categoria também serão apagados."
        onCreate={async (values) => {
          const created = await createCategory(values)
          setCategories((prev) => [...prev, created].sort(byName))
        }}
        onRename={async (item, name) => {
          const updated = await renameCategory(item.id, name)
          setCategories((prev) => prev.map((c) => (c.id === item.id ? updated : c)).sort(byName))
        }}
        onDelete={async (item) => {
          await deleteCategory(item.id)
          setCategories((prev) => prev.filter((c) => c.id !== item.id))
        }}
        onToggleSavings={async (item, isSavings) => {
          const updated = await updateCategorySavingsFlag(item.id, isSavings)
          setCategories((prev) => prev.map((c) => (c.id === item.id ? updated : c)).sort(byName))
        }}
      />

      <ImportSection accounts={accounts} categories={categories} />
    </div>
  )
}
