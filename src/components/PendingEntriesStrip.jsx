import { t } from '../i18n'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import Money from './Money'
import { signedCents } from '../lib/ledgerMath'
import { focusRing } from './ui/styles'

const KIND_TITLES = {
  repaid_to_me: 'ledger.repaidToMe',
  repaid_to_them: 'ledger.repaidToThem',
}

// Faixa "A confirmar" dos Amigos: movimentos que esperam uma resposta minha.
// `entries` vem de listPendingForMe; `friends` dá o nome de cada contacto.
export default function PendingEntriesStrip({ entries, friends }) {
  if (entries.length === 0) return null
  const names = new Map(friends.map((f) => [f.id, f.name]))

  return (
    <section aria-labelledby="pending-entries-title" className="space-y-2">
      <h3 id="pending-entries-title" className="text-sm font-semibold text-label-2">
        A confirmar ({entries.length})
      </h3>
      <ul className="divide-y divide-separator rounded-control border border-separator px-4">
        {entries.map((entry) => {
          const name = names.get(entry.friend_id) ?? t('strip.friend')
          const title = entry.note || (KIND_TITLES[entry.kind] ? t(KIND_TITLES[entry.kind]) : t('kind.expense'))
          const cents = Math.abs(signedCents(entry.kind, entry.amount))
          const action = entry.status === 'cancel_requested' ? t('strip.wantsCancel') : t('strip.toConfirm')
          return (
            <li key={entry.id}>
              <Link
                to={`/dividas/${entry.friend_id}`}
                className={`-mx-2 flex min-h-14 items-center justify-between gap-3 rounded-control px-2 py-2 transition-colors duration-150 ease-out hover:bg-fill active:bg-fill-strong motion-reduce:transition-none ${focusRing}`}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-label">
                    {name} · {title}
                  </span>
                  <span className="block truncate text-xs text-warning">{action}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-sm">
                  <span className="amount font-semibold text-label">
                    <Money value={cents / 100} />
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="text-label-3" />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
