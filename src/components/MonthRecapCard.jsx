import { MessageCircle, X } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../i18n'
import { eur } from '../lib/format'
import { whatsappUrl } from '../lib/contactMessage'
import Card from './Card'
import MascotTile from './MascotTile'
import Money from './Money'
import { focusRing } from './ui/styles'

const KEY_PREFIX = 'stingy.recap.dismissed.'

function wasDismissed(monthKey) {
  try {
    return localStorage.getItem(KEY_PREFIX + monthKey) === '1'
  } catch {
    return false
  }
}

// Resumo do mês passado, nos primeiros dias do mês novo: quanto entrou, quanto
// saiu, o que sobrou e a categoria mais pesada. Pode partilhar-se por WhatsApp
// e fecha-se (só volta no mês seguinte).
export default function MonthRecapCard({ recap }) {
  const t = useT()
  const [hidden, setHidden] = useState(() => wasDismissed(recap.monthKey))
  if (hidden) return null

  const { monthLabel, income, expense, top } = recap
  const net = income - expense

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(KEY_PREFIX + recap.monthKey, '1')
    } catch {
      // volta a aparecer na próxima visita; não é grave
    }
  }

  const lines = [
    t('recap.shareTitle', { month: monthLabel }),
    `${t('list.incomes')}: ${eur(income)}`,
    `${t('list.expenses')}: ${eur(expense)}`,
    `${net >= 0 ? t('r.saved') : t('r.overspent')}: ${eur(Math.abs(net))}`,
  ]
  if (top) lines.push(t('recap.shareTop', { name: top.name, value: eur(top.amount) }))
  lines.push('', t('recap.shareFooter'))
  const shareHref = whatsappUrl('', lines.join('\n'))

  return (
    <Card as="section" aria-label={t('recap.title', { month: monthLabel })} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <MascotTile size={48} motion="cheer" />
          <div className="min-w-0">
            <h2 className="text-[1.0625rem] font-bold tracking-tight text-label">{t('recap.title', { month: monthLabel })}</h2>
            <p className="text-[0.8125rem] text-label-2">{net >= 0 ? t('recap.good') : t('recap.over')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('recap.dismiss')}
          className={`pressable -mt-1 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-label-3 ${focusRing}`}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="min-w-0">
          <dt className="text-[0.75rem] text-label-2">{t('list.incomes')}</dt>
          <dd className="amount truncate text-[1.0625rem] font-semibold text-positive">
            <Money value={income} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.75rem] text-label-2">{t('list.expenses')}</dt>
          <dd className="amount truncate text-[1.0625rem] font-semibold text-negative">
            <Money value={expense} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.75rem] text-label-2">{net >= 0 ? t('r.saved') : t('r.overspent')}</dt>
          <dd className={`amount truncate text-[1.0625rem] font-semibold ${net >= 0 ? 'text-label' : 'text-negative'}`}>
            <Money value={Math.abs(net)} />
          </dd>
        </div>
      </dl>

      {top && (
        <p className="text-[0.8125rem] leading-snug text-label-2">
          {t('recap.top', { name: top.name })} <Money value={top.amount} />
        </p>
      )}

      <a
        href={shareHref}
        target="_blank"
        rel="noopener"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-control border border-separator text-[0.9375rem] font-medium text-label transition-colors hover:bg-fill ${focusRing}`}
      >
        <MessageCircle size={16} aria-hidden="true" /> {t('share.summary')}
      </a>
    </Card>
  )
}
