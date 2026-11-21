import { ChevronRight, Download } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import QuickEntryForm from '../components/QuickEntryForm'
import TransactionList from '../components/TransactionList'
import { useToast } from '../context/toastContext'
import { downloadCsv, toCsv } from '../lib/csv'
import { addMonths, monthStart, today, toIsoDate } from '../lib/dates'
import {
  listAccounts,
  listAllTransactionsForExport,
  listBudgets,
  listCategories,
  listLoggingDates,
  listTransactions,
  listTransactionsInRange,
} from '../lib/db'
import Money from '../components/Money'
import Card from '../components/Card'
import RecurringDueCard from '../components/RecurringDueCard'
import InstallHint from '../components/InstallHint'
import { FirstSteps, StreakCard } from '../components/HabitCard'
import { loggingStreak } from '../lib/streak'
import PageHeader from '../components/ui/PageHeader'
import { eurSigned } from '../lib/format'
import { applyFriendShares, monthTotals } from '../lib/monthTotals'
import { listFriendSharesByTransaction } from '../lib/friendsDb'
import { t } from '../i18n'

export default function Dashboard() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [monthSummary, setMonthSummary] = useState(null)
  const [streak, setStreak] = useState(null)
  const [hasBudget, setHasBudget] = useState(true)
  const [refreshToken, setRefreshToken] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exporting, setExporting] = useState(false)
  const toast = useToast()

  const loadAll = useCallback(async () => {
    setLoadError('')
    try {
      const currentMonthIso = toIsoDate(monthStart(new Date()))
      const [accs, cats, txs, monthTxs] = await Promise.all([
        listAccounts(),
        listCategories(),
        listTransactions({ limit: 50 }),
        listTransactionsInRange({
          from: currentMonthIso,
          to: toIsoDate(addMonths(monthStart(new Date()), 1)),
        }),
      ])
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
      // Empréstimos e devoluções ficam fora do saldo do mês (ver monthTotals).
      const shares = await listFriendSharesByTransaction(monthTxs.map((t) => t.id)).catch(() => new Map())
      setMonthSummary(monthTotals(applyFriendShares(monthTxs, shares, cats), cats))
      // Hábito: sequência de dias seguidos (últimos 400 dias) e se já há orçamento.
      // Falhas aqui não estragam o ecrã: os cartões simplesmente não aparecem.
      const since = toIsoDate(new Date(Date.now() - 400 * 24 * 60 * 60 * 1000))
      const [dates, budgets] = await Promise.all([
        listLoggingDates({ from: since }).catch(() => null),
        listBudgets().catch(() => null),
      ])
      setStreak(dates ? loggingStreak(dates, today()) : null)
      setHasBudget(budgets ? budgets.length > 0 : true)
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function handleExport() {
    setExporting(true)
    try {
      const all = await listAllTransactionsForExport()
      const tipoLabel = { income: t('kind.income'), expense: t('kind.expense'), transfer: t('kind.transfer') }
      const csv = toCsv(all, [
        { label: t('csv.date'), value: (tx) => tx.occurred_on },
        { label: t('csv.type'), value: (tx) => tipoLabel[tx.type] ?? tx.type },
        { label: t('csv.amount'), value: (tx) => Number(tx.amount).toFixed(2) },
        { label: t('csv.category'), value: (tx) => tx.category_name ?? '' },
        { label: t('csv.account'), value: (tx) => tx.account_name ?? '' },
        { label: t('csv.toAccount'), value: (tx) => tx.counter_account_name ?? '' },
        { label: t('csv.note'), value: (tx) => tx.note ?? '' },
      ])
      downloadCsv(`stingy-transacoes-${today()}.csv`, csv)
      toast.success(t('dash.exported', { n: all.length }))
    } catch (err) {
      toast.error(t('dash.exportFailed', { msg: err.message }))
    } finally {
      setExporting(false)
    }
  }

  // Leva o utilizador ao formulário de registo (call-to-action do estado vazio).
  function focusQuickEntry() {
    const input = document.getElementById('quick-entry-amount')
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    input?.focus({ preventScroll: true })
  }

  if (loading) {
    return (
      <>
        <PageHeader title={t('nav.register')} />
        <PageSkeleton />
      </>
    )
  }

  // Só ocupa a página toda se nunca houve dados; num refresh falhado mantém-se o
  // conteúdo já carregado e mostra-se um aviso por cima.
  if (loadError && accounts.length === 0) {
    return (
      <>
        <PageHeader title={t('nav.register')} />
        <ErrorNotice message={loadError} onRetry={loadAll} />
      </>
    )
  }

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <>
        <PageHeader title={t('nav.register')} />
        <EmptyState
          title={t('dash.noDefaults.title')}
          description={t('dash.noDefaults.body')}
        />
      </>
    )
  }

  const saldo = monthSummary ? monthSummary.income - monthSummary.expense : 0
  // Abaixo de meio cêntimo é zero (ver a mesma nota em Balance.jsx): evita o
  // "-0,00 €" a vermelho que a soma em vírgula flutuante podia dar.
  const saldoTone = Math.abs(saldo) < 0.005 ? 'text-label' : saldo > 0 ? 'text-positive' : 'text-negative'

  return (
    <>
      <PageHeader title={t('nav.register')} />

      {loadError && <ErrorNotice message={loadError} onRetry={loadAll} />}

      <InstallHint />

      <FirstSteps hasTransactions={transactions.length > 0} hasBudget={hasBudget} onAddFirst={focusQuickEntry} />

      <StreakCard streak={streak} />

      {monthSummary && (monthSummary.income > 0 || monthSummary.expense > 0) && (
        <button
          type="button"
          onClick={() => navigate('/balanco')}
          className="pressable flex min-h-16 w-full items-center justify-between gap-3 rounded-group bg-surface px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-label-2">{t('dash.monthBalance')}</p>
            <p className={`amount display truncate text-[1.625rem] leading-tight font-bold tracking-tight ${saldoTone}`}>
              <Money>{eurSigned(saldo)}</Money>
            </p>
          </div>
          <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-label-3" />
        </button>
      )}

      <RecurringDueCard
        onLaunched={() => {
          setRefreshToken((prev) => prev + 1)
          loadAll()
        }}
      />

      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        onCreated={(tx) => {
          setTransactions((prev) => [tx, ...prev])
          setRefreshToken((prev) => prev + 1)
          loadAll()
        }}
        onTransferCreated={() => {
          setRefreshToken((prev) => prev + 1)
          loadAll()
        }}
      />

      <Card as="section" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[1.25rem] font-bold tracking-tight text-label">{t('dash.recent')}</h2>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="pressable -mr-2 flex min-h-11 items-center gap-1.5 rounded-control px-2 text-[0.9375rem] font-medium text-accent disabled:opacity-50"
          >
            <Download size={17} aria-hidden="true" />
            {exporting ? t('dash.exporting') : t('dash.exportCsv')}
          </button>
        </div>
        <TransactionList
          categories={categories}
          accounts={accounts}
          refreshToken={refreshToken}
          onAddFirst={focusQuickEntry}
          onRowChanged={loadAll}
        />
      </Card>
    </>
  )
}
