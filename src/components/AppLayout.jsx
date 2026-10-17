import { Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import BottomNav from './BottomNav'
import ConfirmDialog from './ConfirmDialog'
import NotificationToggle from './NotificationToggle'
import PrivacyToggle from './PrivacyToggle'

// TEMPORÁRIO — só para diagnosticar a diferença de safe-area-inset-top entre
// o iPhone 15 Pro e o 17 Pro (ver conversa/commits à volta de bf04f9f). Lê o
// valor real que o iOS reporta, em vez de continuarmos a adivinhar constantes
// às cegas. Remover depois de termos os números dos dois aparelhos.
function SafeAreaDebug() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;height:0;width:0;padding-top:env(safe-area-inset-top);visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    const top = getComputedStyle(probe).paddingTop
    document.body.removeChild(probe)
    setInfo({
      top,
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      standalone: window.navigator.standalone === true,
    })
  }, [])

  if (!info) return null
  return (
    <p className="bg-amber-100 px-4 py-1 text-center text-[10px] text-amber-900 dark:bg-amber-900 dark:text-amber-100">
      DEBUG safe-top: {info.top} · ecrã: {info.viewport} · dpr: {info.dpr} · standalone:{' '}
      {String(info.standalone)}
    </p>
  )
}

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const [confirmLogout, setConfirmLogout] = useState(false)

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

      <SafeAreaDebug />

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
