import { AlertTriangle, RotateCw } from 'lucide-react'
import { Component } from 'react'
import MascotTile from './MascotTile'
import { reportError } from '../lib/monitoring'
import { t } from '../i18n'

// Sem isto, um erro ao desenhar qualquer componente deixava o ecrã todo em branco (o React
// desmonta a árvore inteira). Aqui só cai a parte envolvida e mostra-se como recuperar.
// O AppLayout dá-lhe `key={location.pathname}`, por isso mudar de página limpa o erro sozinho.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Erro ao desenhar a página:', error, info?.componentStack)
    reportError(error, { componentStack: info?.componentStack })
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        className="space-y-3 rounded-control border border-negative/30 bg-negative/10 p-4 text-sm text-negative"
      >
        <MascotTile size={72} motion="oops" className="mx-auto" />
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={16} aria-hidden="true" />
          {t('err.page.title')}
        </p>
        <p>{t('err.page.body')}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-control bg-negative px-3 py-2 font-medium text-white transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-negative"
        >
          <RotateCw size={14} aria-hidden="true" />
          {t('err.page.reload')}
        </button>
      </div>
    )
  }
}
