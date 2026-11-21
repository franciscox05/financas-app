import { t } from '../i18n'
import { SlidersHorizontal, Tags, Wallet } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import BankStatementImportSection from '../components/BankStatementImportSection'
import BudgetsSection from '../components/BudgetsSection'
import RecurringSection from '../components/RecurringSection'
import CategoryRulesSection from '../components/CategoryRulesSection'
import { CARD_CLASS } from '../components/Card'
import EntityManager from '../components/EntityManager'
import { ErrorNotice, ListSkeleton } from '../components/Feedback'
import ImportSection from '../components/ImportSection'
import PageHeader from '../components/ui/PageHeader'
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
  reorderAccounts,
  updateCategorySavingsFlag,
  updateCategoryLendingFlag,
} from '../lib/db'

const ACCOUNT_GROUPS = [
  { type: 'cash', label: 'Contas à ordem' },
  { type: 'investment', label: 'Investimento' },
]

const CATEGORY_GROUPS = [
  { type: 'expense', label: 'Gastos', tone: 'negative' },
  { type: 'income', label: 'Ganhos', tone: 'positive' },
]

const byName = (a, b) => a.name.localeCompare(b.name, 'pt')

// As contas seguem a ordem manual (`sort_order`, definida com as setas nesta
// página); o nome é só o desempate, como em `listAccounts`.
const byAccountOrder = (a, b) =>
  (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name, 'pt')

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

  // Vindo do Balanço ("Definir orçamentos" / "Editar"): /gestao#orcamentos desce até à secção
  // depois de a página ter carregado (o React Router não trata âncoras sozinho).
  const { hash } = useLocation()
  useEffect(() => {
    if (loading || !hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [loading, hash])

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

  // Mesmo raio e mesmo fundo que os cartões do resto da app (ver Card.jsx) —
  // este usava rounded-2xl e destoava de todas as outras páginas.
  const cardClass = CARD_CLASS

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.manage')} subtitle={t('manage.subtitle')} />

      <div className={cardClass}>
        <EntityManager
          title="Contas"
          icon={Wallet}
          noun="conta"
          items={accounts}
          groups={ACCOUNT_GROUPS}
          scope="all"
          deleteWarning="Só é possível apagar se não tiver transações, transferências, atualizações de saldo ou dívidas associadas."
          onCreate={async (values) => {
            const created = await createAccount(values)
            setAccounts((prev) => [...prev, created].sort(byAccountOrder))
            return created
          }}
          onRename={async (item, name) => {
            const updated = await renameAccount(item.id, name)
            setAccounts((prev) => prev.map((a) => (a.id === item.id ? updated : a)).sort(byAccountOrder))
          }}
          onDelete={async (item) => {
            await deleteAccount(item.id)
            setAccounts((prev) => prev.filter((a) => a.id !== item.id))
          }}
          balances={accountBalances}
          onReorder={async (newGroupOrder) => {
            await reorderAccounts(newGroupOrder)
            setAccounts(await listAccounts())
          }}
          onQuickSnapshot={async (item, value) => {
            const created = await createSnapshot({
              accountId: item.id,
              value,
              snapshotDate: today(),
            })
            setSnapshots((prev) => [created, ...prev])
          }}
        />
      </div>

      <div className={cardClass}>
        <EntityManager
          title="Categorias"
          icon={Tags}
          noun="categoria"
          items={categories}
          groups={CATEGORY_GROUPS}
          scope="group"
          tabbed
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
          onToggleLending={async (item, isLending) => {
            const updated = await updateCategoryLendingFlag(item.id, isLending)
            setCategories((prev) => prev.map((c) => (c.id === item.id ? updated : c)).sort(byName))
          }}
        />
      </div>

      <BudgetsSection categories={categories} cardClass={cardClass} />

      <RecurringSection accounts={accounts} categories={categories} cardClass={cardClass} />

      {/* As ferramentas deixam de estar dentro de um cartão: cada uma é uma
          linha própria sobre o fundo da página, que abre no sítio. */}
      <div className="space-y-2">
        <h2 className="flex items-center gap-2 px-1 pb-1 text-[1.25rem] font-bold tracking-tight text-label">
          <SlidersHorizontal size={20} strokeWidth={2.1} aria-hidden="true" className="text-accent" /> Ferramentas avançadas
        </h2>
        <CategoryRulesSection categories={categories} />
        <BankStatementImportSection accounts={accounts} categories={categories} />
        <ImportSection accounts={accounts} categories={categories} />
        <ReclassifySection accounts={accounts} categories={categories} />
      </div>
    </div>
  )
}
