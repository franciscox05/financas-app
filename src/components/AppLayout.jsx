import { UserCircle2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { onAvatarChanged } from '../lib/avatarEvents'
import { subscribeLiveUpdates } from '../lib/liveUpdates'
import { notifyPendingChanged } from '../lib/pendingEvents'
import { getAvatarPath } from '../lib/profileDb'
import { supabase } from '../lib/supabase'
import BottomNav from './BottomNav'
import NotificationToggle from './NotificationToggle'
import PrivacyToggle from './PrivacyToggle'

export default function AppLayout() {
  const { user } = useAuth()
  const [avatarPath, setAvatarPath] = useState(null)

  // Pedidos e movimentos chegam ao vivo; ao voltar à app (iOS suspende o websocket em segundo
  // plano) volta-se a ligar e recarrega-se o que se perdeu. `visibilitychange` sozinho não é
  // fiável numa PWA iOS suspensa há muito tempo — `pageshow` cobre a restauração do bfcache e
  // `focus` cobre voltar de outra app/aba sem um `visibilitychange` claro.
  useEffect(() => {
    let off = subscribeLiveUpdates(user.id)
    function onResume() {
      off()
      off = subscribeLiveUpdates(user.id)
      notifyPendingChanged()
    }
    function onVisible() {
      if (document.visibilityState !== 'visible') return
      onResume()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      off()
    }
  }, [user.id])

  // Foto de perfil no cabeçalho: busca-se ao montar e volta a buscar-se quando
  // o Perfil avisa que mudou (AppLayout fica montado durante toda a sessão,
  // nunca recarrega sozinho ao navegar). Falha silenciosa: sem foto, fica o
  // ícone genérico de sempre.
  useEffect(() => {
    let cancelled = false
    function load() {
      getAvatarPath()
        .then((path) => {
          if (!cancelled) setAvatarPath(path)
        })
        .catch(() => {})
    }
    load()
    const off = onAvatarChanged(load)
    return () => {
      cancelled = true
      off()
    }
  }, [user.id])

  const avatarUrl = avatarPath && supabase.storage.from('avatars').getPublicUrl(avatarPath).data.publicUrl

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
          espaço a mais num 15 Pro — 1.1rem é o meio-termo a testar agora.
          Fixo no topo (sticky), como a BottomNav no fundo: ao fazer scroll o
          conteúdo deixava de passar por trás do relógio/Dynamic Island. Sem
          backdrop-blur pelo mesmo motivo da BottomNav (fantasma no Safari iOS). */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 p-4 pt-[calc(max(1rem,env(safe-area-inset-top))+1.1rem)] dark:border-neutral-800 dark:bg-neutral-900">
        <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          <Wallet size={18} className="text-green-600" />
          FinancasApp
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-neutral-500 sm:inline">{user.email}</span>
          <Link
            to="/perfil"
            aria-label="Perfil"
            className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-neutral-500 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-9 rounded-full object-cover" />
            ) : (
              <UserCircle2 size={20} aria-hidden="true" />
            )}
          </Link>
          <PrivacyToggle />
          <NotificationToggle />
        </div>
      </header>

      <main className="mx-auto max-w-md space-y-6 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
