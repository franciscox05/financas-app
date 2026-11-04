import { AlertTriangle, RotateCw } from 'lucide-react'
import { Component } from 'react'

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
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
      >
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle size={16} aria-hidden="true" />
          Algo correu mal nesta página.
        </p>
        <p>Os teus dados estão guardados. Recarrega para tentar outra vez.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 font-medium text-white transition-colors duration-150 ease-out hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 dark:bg-red-600 dark:hover:bg-red-500"
        >
          <RotateCw size={14} aria-hidden="true" />
          Recarregar
        </button>
      </div>
    )
  }
}
