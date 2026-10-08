import { useCallback, useEffect, useState } from 'react'
import QuickEntryForm from '../components/QuickEntryForm'
import TransactionList from '../components/TransactionList'
import { downloadCsv, toCsv } from '../lib/csv'
import { listAccounts, listAllTransactionsForExport, listCategories, listTransactions } from '../lib/db'

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadAll = useCallback(async () => {
    setError('')
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
      setError(err.message)
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
      const csv = toCsv(all, [
        { label: 'Data', value: (t) => t.occurred_on },
        { label: 'Tipo', value: (t) => (t.type === 'income' ? 'Ganho' : 'Gasto') },
        { label: 'Valor', value: (t) => Number(t.amount).toFixed(2) },
        { label: 'Categoria', value: (t) => t.categories?.name ?? '' },
        { label: 'Conta', value: (t) => t.accounts?.name ?? '' },
        { label: 'Nota', value: (t) => t.note ?? '' },
      ])
      downloadCsv(`financasapp-transacoes-${new Date().toISOString().slice(0, 10)}.csv`, csv)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <p className="py-10 text-center text-sm text-neutral-500">A carregar...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>
  }

  if (accounts.length === 0 || categories.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        Conta sem contas/categorias por defeito. Tenta sair e entrar de novo, ou contacta o
        suporte.
      </p>
    )
  }

  return (
    <>
      <QuickEntryForm
        accounts={accounts}
        categories={categories}
        transactions={transactions}
        onCreated={(tx) => setTransactions((prev) => [tx, ...prev])}
      />

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-500">Transações recentes</h2>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="text-xs text-neutral-500 underline-offset-2 hover:underline disabled:opacity-50"
          >
            {exporting ? 'A exportar...' : 'Exportar CSV'}
          </button>
        </div>
        <TransactionList
          transactions={transactions}
          categories={categories}
          accounts={accounts}
          onChanged={loadAll}
        />
      </section>
    </>
  )
}
