import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-svh bg-neutral-50 p-4 dark:bg-neutral-900">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Finanças
        </h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-500">{user.email}</span>
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
          >
            Sair
          </button>
        </div>
      </header>

      <p className="text-neutral-500 dark:text-neutral-400">
        Registo rápido de transações, balanço e património chegam na Fase 1-3.
      </p>
    </div>
  )
}
