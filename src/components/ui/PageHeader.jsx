// Título grande no topo de cada ecrã principal (estilo iOS). O título pequeno
// na barra de cima aparece sozinho quando este sai do ecrã — ver AppLayout.
// `trailing` leva ações do ecrã (ex.: "+" em Amigos), alinhadas à linha de base.
import MascotTile from '../MascotTile'

export default function PageHeader({ title, subtitle, trailing }) {
  return (
    <header className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h1 className="truncate text-[2.125rem] leading-[1.15] font-bold tracking-tight text-label">{title}</h1>
        {subtitle && <p className="mt-1 text-[0.9375rem] text-label-2">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 pb-0.5">
        {trailing}
        <MascotTile size={44} />
      </div>
    </header>
  )
}
