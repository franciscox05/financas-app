// Galeria do sistema visual: as primitivas e os padrões principais com dados
// inventados, para rever o aspeto (claro/escuro) sem iniciar sessão nem tocar
// na base de dados. Abre-se em desenvolvimento em /galeria.html.
// Regra: aqui só entram componentes que NÃO importam lib/supabase.
import { Plus, TrendingUp } from 'lucide-react'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import CollapsibleSection from '../components/CollapsibleSection'
import { EmptyState, ErrorNotice, Pager, PageSkeleton } from '../components/Feedback'
import Money from '../components/Money'
import MonthCalendar from '../components/MonthCalendar'
import MonthPicker from '../components/MonthPicker'
import PrivacyProvider from '../components/PrivacyProvider'
import ToastProvider from '../components/ToastProvider'
import { useToast } from '../context/toastContext'
import Group, { Row } from '../components/ui/Group'
import IconButton from '../components/ui/IconButton'
import PageHeader from '../components/ui/PageHeader'
import Segmented from '../components/ui/Segmented'
import { dangerButton, inputClass, labelClass, primaryButton, secondaryButton, textButton } from '../components/ui/styles'

const TXS = [
  { id: 1, type: 'expense', amount: 23.4, occurred_on: '2026-11-03', note: 'Supermercado', categories: { name: 'Alimentação' } },
  { id: 2, type: 'income', amount: 950, occurred_on: '2026-11-05', note: 'Ordenado', categories: { name: 'Salário' } },
  { id: 3, type: 'expense', amount: 11.06, occurred_on: '2026-11-12', note: 'Café', categories: { name: 'Lazer' } },
]

function Gallery() {
  const toast = useToast()
  const [type, setType] = useState('expense')
  const [month, setMonth] = useState(new Date(2026, 10, 1))
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  return (
    <div className="min-h-svh bg-canvas text-label">
      <main className="mx-auto max-w-md space-y-8 px-4 py-6">
        <PageHeader
          title="Património"
          trailing={
            <IconButton label="Adicionar" tone="accent">
              <Plus size={26} strokeWidth={2.1} aria-hidden="true" />
            </IconButton>
          }
        />

        <section className="px-1">
          <p className="text-[0.9375rem] text-label-2">Património total</p>
          <p className="amount display mt-1 text-[2.75rem] leading-none font-bold tracking-tight text-label">
            <Money value={12480.37} />
          </p>
        </section>

        <Group list header="Liquidez" aside={<Money value={3480.37} />} footer="Contas à ordem, poupança e dinheiro físico">
          <Row as="button" title="Conta à ordem" subtitle="atualizado 12/11/2026" value={<Money value={2980.37} />} chevron />
          <Row as="button" title="Dinheiro" value={<Money value={500} />} chevron />
        </Group>

        <Group list inset="3rem" header="Insights">
          <li className="flex items-start gap-3 px-4 py-3">
            <TrendingUp size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[0.9375rem] leading-snug text-label">Linha de texto com ícone de aviso.</p>
          </li>
        </Group>

        <section className="rounded-group bg-surface p-5">
          <p className="text-[0.8125rem] font-medium text-label-2">Saldo do mês</p>
          <p className="amount display mt-1 text-[2.5rem] leading-none font-bold tracking-tight text-positive">+915,54 €</p>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t-[0.5px] border-separator pt-4">
            <p className="text-negative">Gasto −34,46 €</p>
            <p className="text-accent">Ação / ligação</p>
          </div>
        </section>

        <MonthPicker value={month} onChange={setMonth} />
        <Segmented
          label="Tipo"
          value={type}
          onChange={setType}
          options={[
            { value: 'expense', label: 'Gasto', tone: 'negative' },
            { value: 'income', label: 'Ganho', tone: 'positive' },
            { value: 'transfer', label: 'Transferência', tone: 'accent' },
          ]}
        />

        <form className="space-y-3 rounded-group bg-surface p-4" onSubmit={(e) => e.preventDefault()}>
          <div>
            <label className={labelClass}>Nota</label>
            <input className={inputClass} placeholder="Ex: supermercado" />
          </div>
          <div>
            <label className={labelClass}>Conta</label>
            <select className={inputClass}>
              <option>Conta à ordem</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="button" className={`${secondaryButton} flex-1`}>Cancelar</button>
            <button type="submit" className={`${primaryButton} flex-[2]`}>Guardar</button>
          </div>
          <button type="button" className={`${dangerButton} w-full`}>Apagar</button>
          <button type="button" className={textButton}>Ação de texto</button>
        </form>

        <MonthCalendar monthDate={month} transactions={TXS} />

        <CollapsibleSection title="Secção recolhível" icon={TrendingUp} open={open} onToggle={() => setOpen((v) => !v)}>
          <p className="text-[0.9375rem] text-label">Conteúdo.</p>
        </CollapsibleSection>

        <ErrorNotice message="Aviso de erro de exemplo." onRetry={() => {}} />
        <EmptyState title="Estado vazio" description="Descrição do estado vazio." actionLabel="Ação" onAction={() => {}} />
        <Pager page={page} totalPages={3} onChange={setPage} />
        <div className="flex gap-2">
          <button type="button" className={secondaryButton} onClick={() => toast.success('Guardado.')}>Aviso de sucesso</button>
          <button type="button" className={secondaryButton} onClick={() => toast.error('Não foi possível guardar.')}>Aviso de erro</button>
        </div>
        <PageSkeleton />
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivacyProvider>
      <ToastProvider>
        <Gallery />
      </ToastProvider>
    </PrivacyProvider>
  </StrictMode>,
)
