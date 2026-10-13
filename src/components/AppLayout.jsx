import { Wallet } from 'lucide-react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BottomNav from './BottomNav'
import NotificationToggle from './NotificationToggle'

export default function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="flex h-dvh flex-col bg-neutral-50 dark:bg-neutral-900">
      <header className="flex shrink-0 items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          <Wallet size={18} className="text-green-600" />
          FinancasApp
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <NotificationToggle />
          <button
            onClick={() => signOut()}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Só o <main> faz scroll; o rodapé é um item normal da coluna (não
          fixed), por isso fica sempre na base, mesmo em páginas curtas. */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto max-w-md space-y-6 px-4 pb-6">
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
