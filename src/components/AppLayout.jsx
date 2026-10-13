import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BottomNav from './BottomNav'
import ConfirmDialog from './ConfirmDialog'
import NotificationToggle from './NotificationToggle'
import PrivacyToggle from './PrivacyToggle'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  return (
    // O +1px torna o documento sempre ligeiramente "scrollável". No iOS (PWA),
    // quando a página não faz scroll o ecrã útil encolhe e a barra fixa fica
    // a meio do ecrã (só acontecia em páginas curtas, como as Dívidas).
    <div className="min-h-[calc(100lvh+1px)] bg-neutral-50 dark:bg-neutral-900">
      <header className="flex items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          <Wallet size={18} className="text-green-600" />
          FinancasApp
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <PrivacyToggle />
          <NotificationToggle />
          <button
            onClick={() => setConfirmLogout(true)}
            className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <BottomNav />

      <ConfirmDialog
        open={confirmLogout}
        title="Terminar sessão?"
        message="Vais ter de entrar novamente para voltar a ver os teus dados."
        confirmLabel="Terminar sessão"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false)
          signOut()
        }}
      />
    </div>
  )
}
