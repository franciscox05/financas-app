// Registo de erros (Sentry). Só liga quando há VITE_SENTRY_DSN (em .env.local e
// nas variáveis da Vercel); sem ela não carrega nada nem envia nada.
// O SDK é importado à parte (import dinâmico) para não pesar no arranque.
// Privacidade: é uma app de finanças, por isso não se envia nada pessoal —
// sem IP nem dados do utilizador, sem gravação de sessão, sem medição de
// desempenho, e os breadcrumbs não levam o texto dos ecrãs nem URLs com dados.
const DSN = import.meta.env.VITE_SENTRY_DSN

let sentry = null
const pending = []

export function initMonitoring() {
  if (!DSN) return
  import('@sentry/react')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: import.meta.env.MODE,
        sendDefaultPii: false,
        tracesSampleRate: 0,
        maxBreadcrumbs: 20,
        beforeBreadcrumb(crumb) {
          // Cliques e consola podem levar valores e nomes do ecrã: fora.
          if (crumb.category === 'ui.click' || crumb.category === 'ui.input' || crumb.category === 'console') return null
          return crumb
        },
        beforeSend(event) {
          delete event.user
          if (event.request) {
            delete event.request.cookies
            delete event.request.headers
            if (event.request.url) event.request.url = event.request.url.split('?')[0].split('#')[0]
          }
          return event
        },
      })
      sentry = Sentry
      pending.splice(0).forEach(([err, ctx]) => Sentry.captureException(err, ctx))
    })
    .catch(() => {})
}

// Regista um erro apanhado (ex.: ErrorBoundary). Sem DSN não faz nada.
export function reportError(error, context) {
  if (!DSN) return
  const ctx = context ? { extra: context } : undefined
  if (sentry) sentry.captureException(error, ctx)
  else pending.push([error, ctx])
}
