import { UserCircle2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { subscribeLiveUpdates } from '../lib/liveUpdates'
import { notifyPendingChanged } from '../lib/pendingEvents'
import BottomNav from './BottomNav'
import ConfirmDialog from './ConfirmDialog'
import NotificationToggle from './NotificationToggle'
import PrivacyToggle from './PrivacyToggle'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

  // Pedidos e movimentos chegam ao vivo; ao voltar à app (iOS suspende o websocket em segundo
  // plano) volta-se a ligar e recarrega-se o que se perdeu.
  useEffect(() => {
    let off = subscribeLiveUpdates(user.id)
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      off()
      off = subscribeLiveUpdates(user.id)
      notifyPendingChanged()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      off()
    }
  }, [user.id])

  return (
    // O +1px torna o documento sempre ligeiramente "scrollável". No iOS (PWA),
    // quando a página não faz scroll o ecrã útil encolhe e a barra fixa fica
    // a meio do ecrã (só acontecia em páginas curtas, como as Dívidas).
    <div className="min-h-[calc(100lvh+1px)] bg-neutral-50 dark:bg-neutral-900">
      {/* Folga extra além do que o iOS reporta como safe-area-inset-top: num
          ecrã (iPhone 17 Pro) o cabeçalho ficava tapado pela zona da
          câmara/Dynamic Island mesmo respeitando o mínimo reportado — um
          screenshot não mostra isto (captura o conteúdo completo, não o que
          fica fisicamente coberto), por isso só se vê ao vivo no aparelho.
          0.75rem não chegou; 1.5rem resolveu no 17 Pro mas ficou com
          espaço a mais num 15 Pro — 1.1rem é o meio-termo a testar agora. */}
      <header className="flex items-center justify-between gap-3 p-4 pt-[calc(max(1rem,env(safe-area-inset-top))+1.1rem)]">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          <Wallet size={18} className="text-green-600" />
          FinancasApp
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <Link
            to="/perfil"
            aria-label="Perfil"
            className="flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <UserCircle2 size={20} aria-hidden="true" />
          </Link>
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
