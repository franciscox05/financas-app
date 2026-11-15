import { Tag, X } from 'lucide-react'
import { useId } from 'react'
import Modal from './Modal'
import Money from './Money'
import { ptDate } from '../lib/format'
import { focusRing } from './ui/styles'

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
              className="flex min-w-0 items-center gap-2 pt-1.5 text-[1.25rem] leading-tight font-bold tracking-tight text-label"
            >
              <Tag size={17} className="shrink-0" style={{ color }} aria-hidden="true" />
              {category.name}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className={`pressable -mt-1.5 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full bg-fill text-label-2 ${focusRing}`}
            >
              <X size={20} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>

          <ul className="divide-y divide-separator">
            {txs.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-label">{tx.note || 'Sem nota'}</p>
                  <p className="text-xs text-label-2">
                    {ptDate(tx.occurred_on)} · {tx.account_name ?? tx.accounts?.name ?? 'Conta'}
                  </p>
                </div>
                <span className="shrink-0 font-medium text-label">
                  <Money value={Number(tx.amount)} />
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-separator pt-3 text-sm font-semibold">
            <span className="text-label">Total</span>
            <span className="text-label">
              <Money value={total} />
            </span>
          </div>
        </>
      )}
    </Modal>
  )
}
