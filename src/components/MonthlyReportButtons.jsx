import { Copy, FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { monthlyReportText } from '../lib/monthlyReport'
import { downloadMonthlyReportPdf } from '../lib/monthlyReportPdf'

const base =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2'

const primaryClass = `${base} bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100`

const secondaryClass = `${base} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100`

// Exportar o mês que está no ecrã — o atual no fecho do mês ou qualquer um do
// histórico, porque o relatório é construído a partir do mês selecionado no
// MonthPicker, não de "hoje". PDF é a ação principal (extrato com KPIs e
// tabelas, pronto a guardar/imprimir); copiar o resumo em texto é a secundária,
// para colar rápido numa conversa.
export default function MonthlyReportButtons({ report, monthKey }) {
  const toast = useToast()
  const [generating, setGenerating] = useState(false)
  const text = useMemo(() => monthlyReportText(report), [report])

  async function handleDownloadPdf() {
    setGenerating(true)
    try {
      // jsPDF/autotable fazem trabalho síncrono pesado para um relatório longo;
      // um microtask evita que o clique pareça preso antes do browser pintar
      // o estado "A gerar...".
      await Promise.resolve()
      downloadMonthlyReportPdf(report, monthKey)
      toast.success('Relatório PDF descarregado.')
    } catch (err) {
      toast.error(`Não foi possível gerar o PDF: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Resumo copiado.')
    } catch {
      toast.error('Não foi possível copiar. Tenta outra vez.')
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <h3 className="text-sm font-semibold text-neutral-500">Relatório do mês</h3>
      <p className="text-xs leading-relaxed text-neutral-400">
        Extrato em PDF com os KPIs do mês, despesas e receitas por categoria e as maiores despesas —
        pronto a guardar ou partilhar.
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleDownloadPdf} disabled={generating} className={primaryClass}>
          <FileDown size={16} aria-hidden="true" />
          {generating ? 'A gerar...' : 'Descarregar PDF'}
        </button>
        <button type="button" onClick={handleCopy} className={secondaryClass}>
          <Copy size={16} aria-hidden="true" />
          Copiar resumo
        </button>
      </div>
    </div>
  )
}
