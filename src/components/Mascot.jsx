import mascot from '../assets/mascote.svg'

// Mascote Stingy (só o guaxinim e a moeda, sem fundo) com animações leves.
// `motion`: 'float' (flutua, para ecrãs vazios), 'wiggle' (abana, para chamar
// atenção), 'pulse' (a pulsar, para carregamentos) ou 'none'.
// As animações param com prefers-reduced-motion (ver index.css).
export default function Mascot({ size = 96, motion = 'float', className = '' }) {
  return (
    <img
      src={mascot}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable="false"
      className={`mascot mascot-${motion} select-none ${className}`}
    />
  )
}
