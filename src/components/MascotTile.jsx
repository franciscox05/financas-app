import Mascot from './Mascot'

// Mascote sobre um azulejo azul-marinho (como o ícone da app): o guaxinim é
// branco, por isso o azulejo mantém-no legível no tema claro e no escuro.
// `size` = lado do azulejo em px.
export default function MascotTile({ size = 96, motion = 'idle', className = '' }) {
  return (
    <div
      className={`grid shrink-0 place-items-center bg-[#0e1d3d] ${className}`}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
    >
      <Mascot size={Math.round(size * 0.8)} motion={motion} />
    </div>
  )
}

// Ecrã inteiro de carregamento: usado enquanto a página ou a sessão carregam.
export function MascotSplash() {
  return (
    <div role="status" aria-label="A carregar" className="grid min-h-dvh place-items-center bg-canvas">
      <MascotTile size={112} motion="load" />
    </div>
  )
}
