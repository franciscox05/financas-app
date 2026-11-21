import { Copy, FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useToast } from '../context/toastContext'
import { monthlyReportText } from '../lib/monthlyReport'

const base =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-control px-4 text-sm font-medium transition duration-150 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2'

const primaryClass = `${base} bg-accent-fill text-white focus-visible:outline-accent`

const secondaryClass = `${base} border border-separator text-label hover:bg-fill focus-visible:outline-accent`

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
      // o estado "A gerar..." (o `await import` abaixo já cede a vez ao browser).
      // O jsPDF (e o html2canvas que traz) só se descarrega aqui, no primeiro clique: são
      // centenas de KB que antes iam no arranque da app para quase nunca serem usados.
      const { downloadMonthlyReportPdf } = await import('../lib/monthlyReportPdf')
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
    <div className="space-y-2 rounded-control border border-separator p-4">
      {/* O mês exportado é sempre o que está ativo no MonthPicker no topo do
          ecrã — nunca "hoje". Nomeá-lo aqui explicitamente evita a dúvida de
          gerar o relatório a pensar que é de um mês e descarregar de outro;
          trocar de mês é mexer no MonthPicker já visível em cima, não precisa
          de um segundo seletor duplicado aqui. */}
      <h3 className="text-sm font-semibold text-label-2">Relatório de {report.monthLabel}</h3>
      <p className="text-xs leading-relaxed text-label-3">
        Extrato em PDF com os KPIs do mês, despesas e receitas por categoria e as maiores despesas —
        pronto a guardar ou partilhar. Para exportar outro mês, muda-o no seletor no topo do ecrã.
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
