import { Tag, X } from 'lucide-react'
import { useId } from 'react'
import Modal from './Modal'
import Money from './Money'
import { ptDate } from '../lib/format'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

// Lista as transações de uma categoria num mês (drill-down das barras do
// Balanço) — só leitura, para editar/apagar usa-se o modal de detalhe já
// existente a partir do Registo. Reutiliza o Modal.jsx partilhado (nunca
// <dialog> nativo, não se comporta como modal real no iPhone).
export default function CategoryDrilldownModal({ category, color, onClose }) {
  const titleId = useId()
  const open = category !== null

  const txs = category?.txs ?? []
  const total = txs.reduce((sum, tx) => sum + Number(tx.amount), 0)

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId}>
      {open && (
        <>
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2
              id={titleId}
              className="flex items-center gap-2 text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100"
            >
              <Tag size={17} className="shrink-0" style={{ color }} aria-hidden="true" />
              {category.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100 ${focusRing}`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-neutral-800 dark:text-neutral-200">{tx.note || 'Sem nota'}</p>
                  <p className="text-xs text-neutral-500">
                    {ptDate(tx.occurred_on)} · {tx.account_name ?? tx.accounts?.name ?? 'Conta'}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-neutral-900 dark:text-neutral-100">
                  <Money value={Number(tx.amount)} />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-3 text-sm font-semibold dark:border-neutral-800">
            <span className="text-neutral-700 dark:text-neutral-300">Total</span>
            <span className="text-neutral-900 dark:text-neutral-100">
              <Money value={total} />
            </span>
          </div>
        </>
      )}
    </Modal>
  )
}
