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
      setMonthSummary(
        monthTxs.reduce(
          (acc, tx) => {
            if (tx.type === 'income') acc.income += Number(tx.amount)
            else acc.expense += Number(tx.amount)
            return acc
          },
          { income: 0, expense: 0 },
        ),
      )
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
      downloadCsv(`financasapp-transacoes-${today()}.csv`, csv)
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
    return <PageSkeleton />
  }

  // Só ocupa a página toda se nunca houve dados; num refresh falhado mantém-se o
  // conteúdo já carregado e mostra-se um aviso por cima.
  if (loadError && accounts.length === 0) {
    return <ErrorNotice message={loadError} onRetry={loadAll} />
  }

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <EmptyState
        title="A tua conta ainda não tem contas ou categorias por defeito."
        description="Sai e volta a entrar para as criarmos. Se continuar, contacta o suporte."
      />
    )
  }

  const saldo = monthSummary ? monthSummary.income - monthSummary.expense : 0

  return (
    <>
      {loadError && <ErrorNotice message={loadError} onRetry={loadAll} />}

      {monthSummary && (monthSummary.income > 0 || monthSummary.expense > 0) && (
        <button
          onClick={() => navigate('/balanco')}
          className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white p-4 text-left dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div>
            <p className="text-xs text-neutral-500">Saldo este mês</p>
            <p
              className={`text-xl font-semibold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {saldo >= 0 ? '+' : '-'}
              <Money value={Math.abs(saldo)} />
            </p>
          </div>
          <ChevronRight className="text-neutral-400" size={20} />
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

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-500">Transações recentes</h2>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1 text-xs text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50"
          >
            <Download size={13} />
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
      </section>
    </>
  )
}
