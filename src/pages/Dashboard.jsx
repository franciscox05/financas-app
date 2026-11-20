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
  listCategories,
  listTransactions,
  listTransactionsInRange,
} from '../lib/db'
import Money from '../components/Money'
import Card from '../components/Card'
import PageHeader from '../components/ui/PageHeader'
import { eurSigned } from '../lib/format'
import { monthTotals } from '../lib/monthTotals'

export default function Dashboard() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [monthSummary, setMonthSummary] = useState(null)
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
      setMonthSummary(monthTotals(monthTxs, cats))
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
      const tipoLabel = { income: 'Ganho', expense: 'Gasto', transfer: 'Transferência' }
      const csv = toCsv(all, [
        { label: 'Data', value: (t) => t.occurred_on },
        { label: 'Tipo', value: (t) => tipoLabel[t.type] ?? t.type },
        { label: 'Valor', value: (t) => Number(t.amount).toFixed(2) },
        { label: 'Categoria', value: (t) => t.category_name ?? '' },
        { label: 'Conta', value: (t) => t.account_name ?? '' },
        { label: 'Conta destino', value: (t) => t.counter_account_name ?? '' },
        { label: 'Nota', value: (t) => t.note ?? '' },
      ])
      downloadCsv(`stingy-transacoes-${today()}.csv`, csv)
      toast.success(`CSV exportado (${all.length} transações).`)
    } catch (err) {
      toast.error(`Não foi possível exportar: ${err.message}`)
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
        <PageHeader title="Registo" />
        <PageSkeleton />
      </>
    )
  }

  // Só ocupa a página toda se nunca houve dados; num refresh falhado mantém-se o
  // conteúdo já carregado e mostra-se um aviso por cima.
  if (loadError && accounts.length === 0) {
    return (
      <>
        <PageHeader title="Registo" />
        <ErrorNotice message={loadError} onRetry={loadAll} />
      </>
    )
  }

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <>
        <PageHeader title="Registo" />
        <EmptyState
          title="A tua conta ainda não tem contas ou categorias por defeito."
          description="Sai e volta a entrar para as criarmos. Se continuar, contacta o suporte."
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
      <PageHeader title="Registo" />

      {loadError && <ErrorNotice message={loadError} onRetry={loadAll} />}

      {monthSummary && (monthSummary.income > 0 || monthSummary.expense > 0) && (
        <button
          type="button"
          onClick={() => navigate('/balanco')}
          className="pressable flex min-h-16 w-full items-center justify-between gap-3 rounded-group bg-surface px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
        >
          <div className="min-w-0">
            <p className="text-[0.8125rem] text-label-2">Saldo este mês</p>
            <p className={`amount display truncate text-[1.625rem] leading-tight font-bold tracking-tight ${saldoTone}`}>
              <Money>{eurSigned(saldo)}</Money>
            </p>
          </div>
          <ChevronRight size={20} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-label-3" />
        </button>
      )}

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
          <h2 className="text-[1.25rem] font-bold tracking-tight text-label">Transações recentes</h2>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="pressable -mr-2 flex min-h-11 items-center gap-1.5 rounded-control px-2 text-[0.9375rem] font-medium text-accent disabled:opacity-50"
          >
            <Download size={17} aria-hidden="true" />
            {exporting ? 'A exportar...' : 'Exportar CSV'}
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
