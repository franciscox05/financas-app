import { BarChart3, PiggyBank, Settings2, Users, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { countPendingForMe } from '../lib/linkedDb'
import { onPendingChanged } from '../lib/pendingEvents'

const TABS = [
  { to: '/', end: true, label: 'Registo', Icon: Wallet },
  { to: '/balanco', label: 'Balanço', Icon: BarChart3 },
  { to: '/patrimonio', label: 'Património', Icon: PiggyBank },
  { to: '/dividas', label: 'Amigos', Icon: Users },
  { to: '/gestao', label: 'Gestão', Icon: Settings2 },
]

const linkClass = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${
    isActive
      ? 'text-neutral-900 dark:text-neutral-100'
      : 'text-neutral-400 dark:text-neutral-500'
  }`

// Número de pedidos/movimentos por responder; qualquer falha = sem emblema.
function usePendingCount() {
  const { pathname } = useLocation()
  const [count, setCount] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => onPendingChanged(() => setTick((t) => t + 1)), [])

  useEffect(() => {
    let active = true
    countPendingForMe()
      .then((n) => {
        if (active) setCount(n)
      })
      .catch(() => {
        if (active) setCount(0)
      })
    return () => {
      active = false
    }
  }, [pathname, tick])

  return count
}

export default function BottomNav() {
  const pending = usePendingCount()
  return (
    <nav
      // Sem backdrop-blur de propósito: um filtro de blur num elemento fixed
      // é a combinação clássica que causa um "fantasma"/duplicação visual no
      // Safari iOS durante o scroll elástico em certos aparelhos (reportado
      // num iPhone 17 Pro, não reproduzido num 15 Pro) — o fundo a 95% de
      // opacidade já dá contraste suficiente sem precisar do blur.
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] dark:border-neutral-800 dark:bg-neutral-900/95"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                  {to === '/dividas' && pending > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium leading-4 text-white"
                    >
                      {pending > 9 ? '9+' : pending}
                    </span>
                  )}
                </span>
                {label}
                {to === '/dividas' && pending > 0 && <span className="sr-only">, {pending} por responder</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
