import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { eur } from '../lib/format'
import { signedCents } from '../lib/ledgerMath'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const KIND_TITLES = {
  repaid_to_me: 'Devolução recebida',
  repaid_to_them: 'Devolução feita',
}

// Faixa "A confirmar" dos Amigos: movimentos que esperam uma resposta minha.
// `entries` vem de listPendingForMe; `friends` dá o nome de cada contacto.
export default function PendingEntriesStrip({ entries, friends }) {
  if (entries.length === 0) return null
  const names = new Map(friends.map((f) => [f.id, f.name]))

  return (
    <section aria-labelledby="pending-entries-title" className="space-y-2">
      <h3 id="pending-entries-title" className="text-sm font-semibold text-neutral-500">
        A confirmar ({entries.length})
      </h3>
      <ul className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 px-4 dark:divide-neutral-800 dark:border-neutral-800">
        {entries.map((entry) => {
          const name = names.get(entry.friend_id) ?? 'Um amigo'
          const title = entry.note || KIND_TITLES[entry.kind] || 'Gasto'
          const cents = Math.abs(signedCents(entry.kind, entry.amount))
          const action = entry.status === 'cancel_requested' ? 'Quer anular este movimento' : 'Para confirmar'
          return (
            <li key={entry.id}>
              <Link
                to={`/dividas/${entry.friend_id}`}
                className={`-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors duration-150 ease-out hover:bg-neutral-100 active:bg-neutral-200 motion-reduce:transition-none dark:hover:bg-neutral-800 dark:active:bg-neutral-700 ${focusRing}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-neutral-800 dark:text-neutral-200">
                    {name} · {title}
                  </span>
                  <span className="block truncate text-xs text-amber-700 dark:text-amber-400">{action}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">{eur(cents / 100)}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-neutral-400" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
