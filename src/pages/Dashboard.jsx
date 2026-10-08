import { useCallback, useEffect, useState } from 'react'
import QuickEntryForm from '../components/QuickEntryForm'
import TransactionList from '../components/TransactionList'
import { useAuth } from '../context/AuthContext'
import { listAccounts, listCategories, listTransactions } from '../lib/db'

export default function Dashboard() {
  const { user, signOut } = useAuth()
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

  return (
    <div className="min-h-svh bg-neutral-50 pb-10 dark:bg-neutral-900">
      <header className="flex items-center justify-between p-4">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Finanças
        </h1>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4">
        {error && <p className="text-sm text-red-600">{error}</p>}

        {loading ? (
          <p className="py-10 text-center text-sm text-neutral-500">A carregar...</p>
        ) : accounts.length === 0 || categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-500">
            Conta sem contas/categorias por defeito. Tenta sair e entrar de novo, ou contacta o
            suporte.
          </p>
        ) : (
          <>
            <QuickEntryForm
              accounts={accounts}
              categories={categories}
              onCreated={(tx) => setTransactions((prev) => [tx, ...prev])}
            />

            <section>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">
                Transações recentes
              </h2>
              <TransactionList
                transactions={transactions}
                categories={categories}
                accounts={accounts}
                onChanged={loadAll}
              />
            </section>
          </>
        )}
      </main>
    </div>
  )
}
