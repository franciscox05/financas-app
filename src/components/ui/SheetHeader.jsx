import { X } from 'lucide-react'
import IconButton from './IconButton'

// Cabeçalho comum das folhas (Modal): título à esquerda, fechar de 44 px à
// direita. `eyebrow` é uma linha pequena por cima do título (ex.: o nome da
// conta por cima do saldo) e `children` fica por baixo (ex.: o valor).
// O `id` liga o título ao `aria-labelledby` do Modal.
export default function SheetHeader({ id, title, eyebrow, onClose, children }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 pt-1.5">
        {eyebrow && <p className="truncate text-[0.8125rem] font-medium text-label-2">{eyebrow}</p>}
        <h2 id={id} className="text-[1.375rem] leading-tight font-bold tracking-tight text-label">
          {title}
        </h2>
        {children}
      </div>
      {onClose && (
        <IconButton label="Fechar" onClick={onClose} className="-mt-1 -mr-2 bg-fill">
          <X size={20} strokeWidth={2.4} aria-hidden="true" />
        </IconButton>
      )}
    </div>
  )
}
