import { ChevronDown, ChevronUp } from 'lucide-react'

// Cabeçalho + corpo recolhível com estilo uniforme — usado nas ferramentas
// avançadas da Gestão (Importar, Corrigir categorias, Regras), para não
// parecerem "escondidas" de formas diferentes em cada uma. `icon` é opcional
// (componente lucide-react), para o visual de "hub" de definições.
export default function CollapsibleSection({ title, description, icon: Icon, open, onToggle, children }) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/60"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          {Icon && <Icon size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />}
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-neutral-400" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-neutral-400" />
        )}
      </button>

      {open && (
        <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          {description && <p className="text-xs text-neutral-500">{description}</p>}
          {children}
        </div>
      )}
    </section>
  )
}
