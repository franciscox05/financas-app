import { RefreshCw, UserCircle2 } from 'lucide-react'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { onAvatarChanged } from '../lib/avatarEvents'
import { today } from '../lib/dates'
import { clearAccountsAndCategoriesCache } from '../lib/db'
import { refreshLiveData, subscribeLiveUpdates } from '../lib/liveUpdates'
import { getAvatarPath } from '../lib/profileDb'
import { supabase } from '../lib/supabase'
import { usePullToRefresh } from '../lib/usePullToRefresh'
import BottomNav from './BottomNav'
import BrandMark from './BrandMark'
import ErrorBoundary from './ErrorBoundary'
import NotificationToggle from './NotificationToggle'
import PrivacyToggle from './PrivacyToggle'

// Título pequeno da barra de cima, por rota. Nos ecrãs com título grande
// (`large`) só aparece depois de esse título sair do ecrã ao fazer scroll, como
// no iOS; nos restantes está sempre visível. Sub-rotas (ex.: um amigo) usam o
// título do separador a que pertencem.
const ROUTE_TITLES = [
  { path: '/', exact: true, title: 'Registo', large: true },
  { path: '/balanco', title: 'Balanço', large: true },
  { path: '/patrimonio', exact: true, title: 'Património', large: true },
  { path: '/patrimonio', title: 'Património' },
  { path: '/dividas', exact: true, title: 'Amigos', large: true },
  { path: '/dividas', title: 'Amigos' },
  { path: '/gestao', title: 'Gestão', large: true },
  { path: '/perfil', title: 'Perfil' },
]

function routeTitle(pathname) {
  return (
    ROUTE_TITLES.find((r) => (r.exact ? pathname === r.path : pathname.startsWith(r.path))) ?? {
      title: '',
      large: false,
    }
  )
}

// A partir de quantos px de scroll o título grande já saiu de vista.
const LARGE_TITLE_SCROLL = 44

export default function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const { title: barTitle, large: hasLargeTitle } = routeTitle(location.pathname)
  const [scrolled, setScrolled] = useState(false)

  // Só guarda um booleano (passou ou não o limiar), por isso o scroll não
  // provoca renders a cada frame — só quando o estado muda de facto.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > LARGE_TITLE_SCROLL)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.pathname])

  const showBarTitle = !hasLargeTitle || scrolled
  const [avatarPath, setAvatarPath] = useState(null)
  // Incrementar remonta a página atual: cada página volta a pedir os seus dados ao montar, por
  // isso puxar para atualizar funciona em todas sem cada uma ter de saber recarregar-se.
  const [reloadKey, setReloadKey] = useState(0)
  const contentRef = useRef(null)
  const indicatorRef = useRef(null)
  const { refreshing, armed } = usePullToRefresh(
    () => {
      clearAccountsAndCategoriesCache()
      refreshLiveData()
      setReloadKey((k) => k + 1)
    },
    { contentRef, indicatorRef },
  )
  const pullReady = refreshing || armed

  // Pedidos e movimentos chegam ao vivo; ao voltar à app (iOS suspende o websocket em segundo
  // plano) volta-se a ligar e recarrega-se o que se perdeu. `visibilitychange` sozinho não é
  // fiável numa PWA iOS suspensa há muito tempo — `pageshow` cobre a restauração do bfcache e
  // `focus` cobre voltar de outra app/aba sem um `visibilitychange` claro.
  // S2-5 (auditoria de 15/11): a PWA fica viva dias em segundo plano e várias páginas calculam
  // "hoje" uma vez ao montar (ex.: a data do Registo). Se o dia mudou desde a última vez,
  // remonta-se a página como no puxar-para-atualizar, senão o primeiro registo da manhã
  // saía com a data de ontem.
  const dayRef = useRef(today())
  useEffect(() => {
    let off = subscribeLiveUpdates(user.id)
    function onResume() {
      off()
      off = subscribeLiveUpdates(user.id)
      refreshLiveData()
      const now = today()
      if (now !== dayRef.current) {
        dayRef.current = now
        setReloadKey((k) => k + 1)
      }
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
    <div className="min-h-[calc(100lvh+1px)] bg-canvas text-label">
      {/* Folga extra além do que o iOS reporta como safe-area-inset-top: num
          ecrã (iPhone 17 Pro) o cabeçalho ficava tapado pela zona da
          câmara/Dynamic Island mesmo respeitando o mínimo reportado — um
          screenshot não mostra isto (captura o conteúdo completo, não o que
          fica fisicamente coberto), por isso só se vê ao vivo no aparelho.
          0.75rem não chegou; 1.5rem resolveu no 17 Pro mas ficou com
          espaço a mais num 15 Pro — 1.1rem é o meio-termo a testar agora.
          Fixo no topo (sticky), como a BottomNav no fundo: ao fazer scroll o
          conteúdo deixava de passar por trás do relógio/Dynamic Island. Sem
          backdrop-blur pelo mesmo motivo da BottomNav (fantasma no Safari iOS)
          — `material-bar` é opaco por omissão, ver index.css.
          Redesenho 2026-11: o padding de cima (a parte afinada no aparelho)
          ficou igual; a barra em si passou a ter 44 px, com o título do ecrã
          ao centro (aparece quando o título grande sai de vista) e as ações
          com alvos de 44 px. A linha de baixo só se vê depois de haver scroll. */}
      <header
        className={`material-bar sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b-[0.5px] px-2 pt-[calc(max(1rem,env(safe-area-inset-top))+1.1rem)] transition-[border-color] duration-200 ${
          scrolled ? 'border-separator' : 'border-transparent'
        }`}
      >
        <div className="flex h-11 items-center">
          <Link
            to="/perfil"
            aria-label="Perfil"
            className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-label-2"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="size-8 rounded-full object-cover" />
            ) : (
              <UserCircle2 size={26} strokeWidth={1.6} aria-hidden="true" />
            )}
          </Link>
        </div>
        {/* Ao centro: a marca enquanto o título grande do ecrã está à vista; ao fazer scroll
            troca (com fade) pelo título pequeno, como no iOS. Ecrãs sem título grande mostram
            sempre o título. */}
        <div className="relative grid min-w-0 place-items-center">
          <BrandMark
            size={24}
            className={`col-start-1 row-start-1 transition-opacity duration-200 ease-apple motion-reduce:transition-none ${
              showBarTitle ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          />
          <p
            aria-hidden={!showBarTitle}
            className={`col-start-1 row-start-1 truncate text-center text-[1.0625rem] font-semibold tracking-tight text-label transition-opacity duration-200 ease-apple motion-reduce:transition-none ${
              showBarTitle ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {barTitle}
          </p>
        </div>
        <div className="flex h-11 items-center justify-end">
          <PrivacyToggle />
          <NotificationToggle />
        </div>
      </header>

      {/* Indicador do "puxar para atualizar". Contentor com altura 0 (não empurra nada); o hook
          move o indicador e o <main> só com transform, direto no DOM, a cada frame. Fica por baixo
          do cabeçalho (z-10 < z-20), por isso parece sair de trás dele. O ícone roda com o dedo
          (--ptr-rotate) e fica verde, com um pequeno "pop", quando já basta largar. */}
      <div className="relative z-10 h-0" role="status">
        <div
          ref={indicatorRef}
          className="material-float absolute top-0 left-1/2 flex size-9 items-center justify-center rounded-full opacity-0 shadow-[var(--shadow-raised)] will-change-transform"
          style={{ transform: 'translate3d(-50%, -36px, 0) scale(0.5)' }}
        >
          <span
            className={`flex transition-transform duration-200 ease-out ${pullReady ? 'scale-110' : 'scale-100'}`}
          >
            <RefreshCw
              size={17}
              strokeWidth={2.25}
              className={`transition-colors duration-200 ${pullReady ? 'text-accent' : 'text-label-3'} ${refreshing ? 'motion-safe:animate-spin' : ''}`}
              style={refreshing ? undefined : { transform: 'rotate(var(--ptr-rotate, 0deg))' }}
            />
          </span>
          <span className="sr-only">{refreshing ? 'A atualizar…' : ''}</span>
        </div>
      </div>

      <main
        ref={contentRef}
        className="mx-auto max-w-md space-y-6 px-4 pt-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))]"
      >
        <ErrorBoundary key={`${location.pathname}:${reloadKey}`}>
          {/* As páginas carregam por partes (App.jsx); enquanto o pedaço chega fica vazio por
              baixo das barras, que já estão desenhadas — normalmente é instantâneo porque
              App.jsx os pede todos em segundo plano logo a seguir ao arranque. */}
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>

      <BottomNav />
    </div>
  )
}
