// Blocos de feedback partilhados: skeletons de carregamento, estados vazios com
// call-to-action e aviso de erro. A animação respeita prefers-reduced-motion.
import { X } from 'lucide-react'
import MascotTile from './MascotTile'
import { t } from '../i18n'

export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-control bg-fill motion-reduce:animate-none ${className}`}
    />
  )
}

export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className="space-y-3 rounded-group bg-surface p-4"
    >
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-9" />
        <Skeleton className="h-9" />
      </div>
      <Skeleton className="h-14" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-11" />
    </div>
  )
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <ul role="status" aria-label={t('common.loading')} className="divide-y divide-separator">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center justify-between gap-3 py-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </li>
      ))}
    </ul>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div role="status" aria-label={t('common.loading')} className="pt-2">
        <MascotTile size={96} motion="load" className="mx-auto mb-3" />
      </div>
      <FormSkeleton />
      <ListSkeleton />
    </div>
  )
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-group bg-fill px-5 py-9 text-center">
      <MascotTile size={96} motion="idle" className="mx-auto mb-3" />
      <p className="text-[1.0625rem] font-semibold tracking-tight text-label">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-xs text-[0.8125rem] leading-snug text-label-2">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 min-h-11 rounded-control bg-accent-fill px-5 text-[0.9375rem] font-semibold text-white transition-opacity duration-150 active:opacity-70"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// Paginação simples com "Anterior"/"Seguinte", usada em qualquer listagem
// paginada (transações, histórico de saldo, dívidas acertadas, etc.).
export function Pager({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="pressable min-h-11 rounded-control px-3 text-[0.9375rem] font-medium text-accent disabled:text-label-3"
      >
        {t('common.prev')}
      </button>
      <span className="amount text-[0.8125rem] text-label-2">
        {t('common.page', { page, total: totalPages })}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="pressable min-h-11 rounded-control px-3 text-[0.9375rem] font-medium text-accent disabled:text-label-3"
      >
        {t('common.next')}
      </button>
    </div>
  )
}

export function ErrorNotice({ message, onRetry, onDismiss }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-control bg-negative/10 px-4 py-2 text-[0.9375rem] leading-snug text-negative"
    >
      <span>{message}</span>
      <span className="flex shrink-0 gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="min-h-11 px-1 font-semibold">
            {t('common.retry')}
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('common.close')}
            className="-mr-2 flex size-11 items-center justify-center opacity-70 hover:opacity-100"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </span>
    </div>
  )
}
