import { useCallback, useEffect, useState } from 'react'
import QuickEntryForm from '../components/QuickEntryForm'
import TransactionList from '../components/TransactionList'
import { listAccounts, listCategories, listTransactions } from '../lib/db'

export default function Dashboard() {
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        onCreated={(tx) => setTransactions((prev) => [tx, ...prev])}
      />

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-500">Transações recentes</h2>
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
