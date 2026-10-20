import { useCallback, useEffect, useMemo, useState } from 'react'
import CategoryRulesSection from '../components/CategoryRulesSection'
import EntityManager from '../components/EntityManager'
import { ErrorNotice, ListSkeleton } from '../components/Feedback'
import ImportSection from '../components/ImportSection'
import MbwayPhoneSection from '../components/MbwayPhoneSection'
import ReclassifySection from '../components/ReclassifySection'
import { balanceAt } from '../lib/accountBalance'
import { today } from '../lib/dates'
import {
  createAccount,
  createCategory,
  createSnapshot,
  deleteAccount,
  deleteCategory,
  listAccounts,
  listAllTransactionsForBalance,
  listCategories,
  listNetWorthSnapshots,
  listTransfers,
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
  const [transactions, setTransactions] = useState([])
  const [snapshots, setSnapshots] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [accs, cats, txs, snaps, trs] = await Promise.all([
        listAccounts(),
        listCategories(),
        listAllTransactionsForBalance(),
        listNetWorthSnapshots(),
        listTransfers(),
      ])
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
      setSnapshots(snaps)
      setTransfers(trs)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const accountBalances = useMemo(() => {
    const now = today()
    const map = new Map()
    for (const account of accounts) {
      map.set(account.id, balanceAt(account.id, transactions, snapshots, now, transfers))
    }
    return map
  }, [accounts, transactions, snapshots, transfers])

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
        deleteWarning="Só é possível apagar se não tiver transações, transferências, atualizações de saldo ou dívidas associadas."
        onCreate={async (values) => {
          const created = await createAccount(values)
          setAccounts((prev) => [...prev, created].sort(byName))
          return created
        }}
        onRename={async (item, name) => {
          const updated = await renameAccount(item.id, name)
          setAccounts((prev) => prev.map((a) => (a.id === item.id ? updated : a)).sort(byName))
        }}
        onDelete={async (item) => {
          await deleteAccount(item.id)
          setAccounts((prev) => prev.filter((a) => a.id !== item.id))
        }}
        balances={accountBalances}
        onQuickSnapshot={async (item, value) => {
          const created = await createSnapshot({
            accountId: item.id,
            value,
            snapshotDate: today(),
          })
          setSnapshots((prev) => [created, ...prev])
        }}
      />

      <EntityManager
        title="Categorias"
        noun="categoria"
        items={categories}
        groups={CATEGORY_GROUPS}
        scope="group"
        deleteWarning="Só é possível apagar se não tiver transações associadas. Regras de categorização desta categoria são apagadas juntamente."
        onCreate={async (values) => {
          const created = await createCategory(values)
          setCategories((prev) => [...prev, created].sort(byName))
          return created
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

      <MbwayPhoneSection />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-500">Ferramentas avançadas</h2>
        <CategoryRulesSection categories={categories} />
        <ImportSection accounts={accounts} categories={categories} />
        <ReclassifySection accounts={accounts} categories={categories} />
      </section>
    </div>
  )
}
