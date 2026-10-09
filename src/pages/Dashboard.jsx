import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorNotice, PageSkeleton } from '../components/Feedback'
import QuickEntryForm from '../components/QuickEntryForm'
import RecurringSection from '../components/RecurringSection'
import TransactionList from '../components/TransactionList'
import { downloadCsv, toCsv } from '../lib/csv'
import { today } from '../lib/dates'
import { listAccounts, listAllTransactionsForExport, listCategories, listTransactions } from '../lib/db'

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoadError('')
    try {
      const [accs, cats, txs] = await Promise.all([
        listAccounts(),
        listCategories(),
        listTransactions({ limit: 50 }),
      ])
      setAccounts(accs)
      setCategories(cats)
      setTransactions(txs)
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
    setExportError('')
    try {
      const all = await listAllTransactionsForExport()
      const csv = toCsv(all, [
        { label: 'Data', value: (t) => t.occurred_on },
        { label: 'Tipo', value: (t) => (t.type === 'income' ? 'Ganho' : 'Gasto') },
        { label: 'Valor', value: (t) => Number(t.amount).toFixed(2) },
        { label: 'Categoria', value: (t) => t.categories?.name ?? '' },
        { label: 'Conta', value: (t) => t.accounts?.name ?? '' },
        { label: 'Nota', value: (t) => t.note ?? '' },
      ])
      downloadCsv(`financasapp-transacoes-${today()}.csv`, csv)
    } catch (err) {
      setExportError(`Não foi possível exportar: ${err.message}`)
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

  return (
    <>
      {loadError && <ErrorNotice message={loadError} onRetry={loadAll} />}

      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        onCreated={(tx) => setTransactions((prev) => [tx, ...prev])}
      />

      <RecurringSection accounts={accounts} categories={categories} onLaunched={loadAll} />

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-500">Transações recentes</h2>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {exporting ? 'A exportar...' : 'Exportar CSV'}
          </button>
        </div>
        <ErrorNotice message={exportError} onDismiss={() => setExportError('')} />
        <TransactionList
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onChanged={loadAll}
          onAddFirst={focusQuickEntry}
        />
      </section>
    </>
  )
}
