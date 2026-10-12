// Blocos de feedback partilhados: skeletons de carregamento, estados vazios com
// call-to-action e aviso de erro. A animação respeita prefers-reduced-motion.

export function Skeleton({ className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800 ${className}`}
    />
  )
}

export function FormSkeleton() {
  return (
    <div
      role="status"
      aria-label="A carregar"
      className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
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
    <ul role="status" aria-label="A carregar" className="divide-y divide-neutral-200 dark:divide-neutral-800">
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
      <FormSkeleton />
      <ListSkeleton />
    </div>
  )
}

export function EmptyState({ title, description, actionLabel, onAction }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center dark:border-neutral-700">
      <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
      {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
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
    <div className="flex items-center justify-between pt-1 text-sm">
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40 dark:border-neutral-700"
      >
        Anterior
      </button>
      <span className="text-xs text-neutral-500">
        Página {page} de {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40 dark:border-neutral-700"
      >
        Seguinte
      </button>
    </div>
  )
}

export function ErrorNotice({ message, onRetry, onDismiss }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
    >
      <span>{message}</span>
      <span className="flex shrink-0 gap-2">
        {onRetry && (
          <button type="button" onClick={onRetry} className="font-medium underline-offset-2 hover:underline">
            Tentar de novo
          </button>
        )}
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Fechar" className="opacity-70 hover:opacity-100">
            ✕
          </button>
        )}
      </span>
    </div>
  )
}
