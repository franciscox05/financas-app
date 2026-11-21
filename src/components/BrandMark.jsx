import { useEffect, useState } from 'react'
import MascotTile from './MascotTile'

// Evento global: disparado quando algo corre bem (aviso de sucesso). O ícone da
// marca reage com um pequeno salto, para a app ter uma resposta "viva".
export const CELEBRATE_EVENT = 'stingy:celebrate'

// Marca Stingy: o ícone (guaxinim amarrado à moeda) com um texto ao lado (o nome,
// ou o título do ecrã quando já se fez scroll). `size` = altura do ícone em px.
// O ícone fica sempre visível no cabeçalho; o texto é o nome da marca por omissão.
export default function BrandMark({ size = 24, text = 'Stingy', className = '' }) {
  // Cada celebração muda a chave do <img>, o que reinicia a animação CSS.
  const [pops, setPops] = useState(0)
  useEffect(() => {
    const onCelebrate = () => setPops((n) => n + 1)
    window.addEventListener(CELEBRATE_EVENT, onCelebrate)
    return () => window.removeEventListener(CELEBRATE_EVENT, onCelebrate)
  }, [])

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      {/* A chave muda a cada sucesso: o mascote volta a fazer a festa. */}
      <MascotTile key={pops} size={size} motion={pops > 0 ? 'cheer' : 'idle'} />
      <span className="truncate text-[1.0625rem] font-bold tracking-tight text-label">{text}</span>
    </span>
  )
}
