import { ChevronDown, ChevronUp } from 'lucide-react'

// Cabeçalho + corpo recolhível com estilo uniforme — usado nas ferramentas
// avançadas da Gestão (Importar, Corrigir categorias, Regras), para não
// parecerem "escondidas" de formas diferentes em cada uma. `icon` é opcional
// (componente lucide-react), para o visual de "hub" de definições.
export default function CollapsibleSection({ title, description, icon: Icon, open, onToggle, children }) {
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="pressable flex min-h-12 w-full items-center justify-between gap-3 rounded-group bg-surface px-4 py-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-3 text-[1.0625rem] text-label">
          {Icon && <Icon size={20} strokeWidth={1.9} className="shrink-0 text-accent" aria-hidden="true" />}
          {title}
        </span>
        {open ? (
          <ChevronUp size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-label-3" />
        ) : (
          <ChevronDown size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0 text-label-3" />
        )}
      </button>

      {open && (
        <div className="space-y-3 rounded-group bg-surface p-4">
          {description && <p className="text-[0.8125rem] leading-snug text-label-2">{description}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
