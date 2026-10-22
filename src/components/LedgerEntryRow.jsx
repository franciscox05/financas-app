import { Trash2 } from 'lucide-react'
import Money from './Money'
import PendingEntryActions from './PendingEntryActions'
import { entryLabel, signedCents } from '../lib/ledgerMath'
import { entryStatusText } from '../lib/linkedLogic'
import { eur } from '../lib/format'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// 'YYYY-MM-DD' -> '19 out' (sem passar por Date, para não haver desvios de fuso).
function shortDate(iso) {
  const [, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}`
}

const KIND_TITLES = {
  repaid_to_me: 'Devolução recebida',
  repaid_to_them: 'Devolução feita',
}

const TONE_CLASS = {
  waiting: 'text-neutral-500 dark:text-neutral-400',
  action: 'font-medium text-amber-700 dark:text-amber-400',
  danger: 'text-red-700 dark:text-red-400',
  muted: 'text-neutral-400 dark:text-neutral-500',
}

// Estados em que o movimento não conta para o saldo (aparece esbatido).
const NOT_COUNTING = ['pending', 'declined', 'cancelled', 'archived']

// Uma linha do conta-corrente: título (nota ou tipo), data + tipo, valor com
// sinal (verde = ele deve-me mais; vermelho = eu devo-lhe mais) e apagar.
// Movimentos partilhados (mirror_id) e arquivados não se apagam: têm ações
// próprias (PendingEntryActions) quando `friend` e `viewerId` são dados.
export default function LedgerEntryRow({ entry, friend, viewerId, onDelete, onChanged, onResend }) {
  const cents = signedCents(entry.kind, entry.amount)
  const positive = cents > 0
  const title = entry.note || KIND_TITLES[entry.kind] || 'Gasto'
  const formatted = `${positive ? '+' : '−'}${eur(Math.abs(cents) / 100)}`
  const status = friend && viewerId ? entryStatusText(entry, viewerId, friend.name) : { text: '', tone: 'none' }
  const dimmed = NOT_COUNTING.includes(entry.status)
  const canDelete = !entry.mirror_id && entry.status !== 'archived'
  const amountColor = dimmed
    ? 'text-neutral-400 dark:text-neutral-500'
    : positive
      ? 'text-green-700 dark:text-green-500'
      : 'text-red-700 dark:text-red-500'
  const muted = dimmed

  return (
    <li className="space-y-2 py-2">
      <div className="flex min-h-14 items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate font-medium ${
              muted ? 'text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-neutral-500">
            {shortDate(entry.occurred_on)} · {entryLabel(entry.kind)}
          </p>
          {status.text && <p className={`text-xs ${TONE_CLASS[status.tone] ?? ''}`}>{status.text}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className={`text-sm font-semibold ${amountColor}`}>
            <Money>{formatted}</Money>
          </span>
          {canDelete && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(entry)}
              aria-label={`Apagar movimento: ${title}`}
              className={`flex size-11 items-center justify-center rounded-lg text-neutral-400 transition-colors duration-150 ease-out hover:text-red-600 active:scale-[0.95] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      {friend?.status === 'connected' && viewerId && (
        <PendingEntryActions
          entry={entry}
          friend={friend}
          viewerId={viewerId}
          onChanged={onChanged}
          onResend={onResend}
        />
      )}
    </li>
  )
}
