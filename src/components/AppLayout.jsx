import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import NotificationToggle from './NotificationToggle'

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium ${
    isActive
      ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
  }`

export default function AppLayout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-svh bg-neutral-50 pb-[max(2.5rem,env(safe-area-inset-bottom))] dark:bg-neutral-900">
      <header className="flex flex-wrap items-center justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={navLinkClass}>
            Registo
          </NavLink>
          <NavLink to="/balanco" className={navLinkClass}>
            Balanço
          </NavLink>
          <NavLink to="/patrimonio" className={navLinkClass}>
            Património
          </NavLink>
          <NavLink to="/dividas" className={navLinkClass}>
            Dívidas
          </NavLink>
        </div>
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

      <main className="mx-auto max-w-md space-y-6 px-4">
        <Outlet />
      </main>
    </div>
  )
}
