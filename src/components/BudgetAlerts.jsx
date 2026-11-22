import { AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { focusRing } from './ui/styles'

const TONE = { warn: 'text-warning', over: 'text-negative' }

// Aviso no Registo quando um orçamento do mês está a 80 % ou ultrapassado.
// `rows` vem de `budgetProgress` (lib/budgets.js); sem alertas, não mostra nada.
export default function BudgetAlerts({ rows }) {
  const t = useT()
  const alerts = (rows ?? []).filter((r) => r.status !== 'ok')
  if (alerts.length === 0) return null

  return (
    <Link
      to="/balanco"
      aria-live="polite"
      className={`pressable block space-y-1.5 rounded-group bg-surface p-4 ${focusRing}`}
    >
      {alerts.slice(0, 3).map((r) => (
        <p key={r.categoryId} className={`flex items-start gap-2 text-[0.875rem] leading-snug ${TONE[r.status]}`}>
          <AlertTriangle size={16} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
          <span>
            {r.status === 'over'
              ? t('bud.card.overMsg', { name: r.name })
              : t('bud.card.warn', { name: r.name, pct: Math.floor(r.ratio * 100) })}
          </span>
        </p>
      ))}
      {alerts.length > 3 && <p className="pl-6 text-[0.8125rem] text-label-2">{t('bud.more', { n: alerts.length - 3 })}</p>}
    </Link>
  )
}
