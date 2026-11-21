import stingyIcon from '../assets/stingy-icone.svg'

// Marca Stingy: o ícone (guaxinim amarrado à moeda) com o nome ao lado.
// `size` = altura do ícone em px. Decorativo quando há texto à volta que já diz
// o nome; o próprio nome fica visível para leitores de ecrã.
export default function BrandMark({ size = 24, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={stingyIcon}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        style={{ borderRadius: size * 0.225 }}
        className="shrink-0"
      />
      <span className="text-[1.0625rem] font-bold tracking-tight text-label">Stingy</span>
    </span>
  )
}
