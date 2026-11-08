import { Copy, Download } from 'lucide-react'
import { useMemo } from 'react'
import { useToast } from '../context/toastContext'
import { downloadCsv } from '../lib/csv'
import { monthlyReportCsv, monthlyReportFilename, monthlyReportText } from '../lib/monthlyReport'

const base =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2'

const primaryClass = `${base} bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:outline-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300 dark:focus-visible:outline-neutral-100`

const secondaryClass = `${base} border border-neutral-300 text-neutral-800 hover:bg-neutral-100 focus-visible:outline-neutral-900 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 dark:focus-visible:outline-neutral-100`

// Exportar o mês que está no ecrã — o atual no fecho do mês ou qualquer um do
// histórico, porque o relatório é construído a partir do mês selecionado no
// MonthPicker, não de "hoje".
export default function MonthlyReportButtons({ report, monthKey }) {
  const toast = useToast()
  const text = useMemo(() => monthlyReportText(report), [report])

  function handleDownload() {
    try {
      downloadCsv(monthlyReportFilename(monthKey), monthlyReportCsv(report))
      toast.success('Relatório descarregado.')
    } catch (err) {
      toast.error(`Não foi possível gerar o relatório: ${err.message}`)
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
        Resumo de receitas e despesas por categoria, poupança líquida, maiores despesas e a evolução
        dos 6 meses até este.
      </p>
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleDownload} className={primaryClass}>
          <Download size={16} aria-hidden="true" />
          Descarregar CSV
        </button>
        <button type="button" onClick={handleCopy} className={secondaryClass}>
          <Copy size={16} aria-hidden="true" />
          Copiar resumo
        </button>
      </div>
    </div>
  )
}
