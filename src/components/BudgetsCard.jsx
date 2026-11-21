import { AlertTriangle, Target } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useT } from '../i18n'
import { budgetTotals } from '../lib/budgets'
import { eur } from '../lib/format'
import Money from './Money'
import { focusRing } from './ui/styles'

const BAR_TONE = { ok: 'var(--accent)', warn: 'var(--warning)', over: 'var(--negative)' }
const TEXT_TONE = { ok: 'text-label-2', warn: 'text-warning', over: 'text-negative' }

// Balanço → Orçamentos do mês selecionado: uma barra por categoria com limite,
// a mais perto de rebentar primeiro, e avisos aos 80 % e aos 100 %.
// `rows` vem de `budgetProgress` (lib/budgets.js).
export default function BudgetsCard({ rows }) {
  const t = useT()
  const linkClass = `-my-2 inline-flex min-h-11 items-center px-1 text-[0.9375rem] font-medium text-accent ${focusRing}`

  if (rows.length === 0) {
    return (
      <section aria-label={t('bud.title')} className="rounded-group bg-surface p-4">
        <div className="flex items-start gap-3">
          <Target size={20} strokeWidth={2.1} aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-[0.9375rem] font-semibold text-label">{t('bud.title')}</p>
            <p className="text-[0.8125rem] leading-snug text-label-2">{t('bud.card.empty')}</p>
          </div>
          <Link to="/gestao#orcamentos" className={linkClass}>
            {t('bud.card.setup')}
          </Link>
        </div>
      </section>
    )
  }

  const totals = budgetTotals(rows)
  const alerts = rows.filter((r) => r.status !== 'ok')

  return (
    <section aria-label={t('bud.title')} className="space-y-2">
      <div className="flex min-h-6 items-baseline justify-between gap-3 px-4">
        <h2 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">{t('bud.title')}</h2>
        <Link to="/gestao#orcamentos" className={linkClass}>
          {t('bud.card.edit')}
        </Link>
      </div>

      {alerts.length > 0 && (
        <ul className="space-y-1.5 rounded-group bg-surface p-4" aria-live="polite">
          {alerts.map((r) => (
            <li key={r.categoryId} className={`flex items-start gap-2 text-[0.875rem] leading-snug ${TEXT_TONE[r.status]}`}>
              <AlertTriangle size={16} strokeWidth={2.2} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                {r.status === 'over'
                  ? t('bud.card.overMsg', { name: r.name })
                  : t('bud.card.warn', { name: r.name, pct: Math.floor(r.ratio * 100) })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="grouped overflow-hidden rounded-group bg-surface">
        {rows.map((r) => (
          <li key={r.categoryId} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[1.0625rem] text-label">{r.name}</span>
              <span className="amount shrink-0 text-[0.9375rem] text-label-2">
                <Money>{t('bud.card.of', { spent: eur(r.spent), limit: eur(r.limit) })}</Money>
              </span>
            </div>
            <div
              className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-fill"
              role="progressbar"
              aria-label={r.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.round(r.ratio * 100))}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.min(100, r.ratio * 100)}%`, backgroundColor: BAR_TONE[r.status] }}
              />
            </div>
            <p className={`amount mt-1 text-xs ${TEXT_TONE[r.status]}`}>
              <Money>
                {r.remaining >= 0
                  ? t('bud.card.left', { value: eur(r.remaining) })
                  : t('bud.card.over', { value: eur(-r.remaining) })}
              </Money>
            </p>
          </li>
        ))}
        <li className="flex min-h-11 items-center justify-between gap-3 px-4 py-2.5 text-[0.9375rem] font-semibold text-label">
          <span>{t('bud.card.total')}</span>
          <span className="amount">
            <Money>{t('bud.card.of', { spent: eur(totals.spent), limit: eur(totals.limit) })}</Money>
          </span>
        </li>
      </ul>
    </section>
  )
}
