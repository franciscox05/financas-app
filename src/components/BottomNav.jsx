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

// 49 px de altura (a da barra de separadores do iOS) e cada separador ocupa um
// quinto da largura — alvo de toque sempre acima dos 44 px. O ativo distingue-se
// pela cor de destaque e pelo traço mais grosso, não só por ser mais escuro.
const linkClass = ({ isActive }) =>
  `flex min-h-[3.0625rem] flex-1 flex-col items-center justify-center gap-0.5 text-[0.625rem] font-medium tracking-wide transition-colors duration-150 ease-apple motion-reduce:transition-none ${
    isActive ? 'text-accent' : 'text-label-3'
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
      // num iPhone 17 Pro, não reproduzido num 15 Pro). Fundo 100% opaco
      // (sem /95) — a transparência deixava o conteúdo transparecer ao
      // fazer scroll, mesmo ponto corrigido no cabeçalho (Fase 1 do UI/UX).
      // `material-bar` (index.css) mantém isto: opaco por omissão, com o
      // desfoque atrás de um interruptor para testar no aparelho.
      className="material-bar fixed inset-x-0 bottom-0 z-20 border-t-[0.5px] border-separator pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon size={24} strokeWidth={isActive ? 2.1 : 1.7} aria-hidden="true" />
                  {to === '/dividas' && pending > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-2.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[10px] font-semibold leading-4 text-white"
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
