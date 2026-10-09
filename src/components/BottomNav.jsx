import { BarChart3, HandCoins, PiggyBank, Settings2, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/', end: true, label: 'Registo', Icon: Wallet },
  { to: '/balanco', label: 'Balanço', Icon: BarChart3 },
  { to: '/patrimonio', label: 'Património', Icon: PiggyBank },
  { to: '/dividas', label: 'Dívidas', Icon: HandCoins },
  { to: '/gestao', label: 'Gestão', Icon: Settings2 },
]

const linkClass = ({ isActive }) =>
  `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium ${
    isActive
      ? 'text-neutral-900 dark:text-neutral-100'
      : 'text-neutral-400 dark:text-neutral-500'
  }`

export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95"
      aria-label="Navegação principal"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
