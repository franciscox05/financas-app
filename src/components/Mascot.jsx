import { MASCOT_PATHS as P } from './mascotPaths'

// Mascote Stingy (guaxinim e moeda) em camadas, para cada parte mexer sozinha.
// `motion`: 'idle' (respira, pisca, cauda e moeda mexem), 'cheer' (festa de
// sucesso), 'load' (moeda a girar), 'oops' (abana a cabeça, erros), 'enter'
// (entrada) ou 'none'. As animações param com prefers-reduced-motion.
export default function Mascot({ size = 96, motion = 'idle', className = '' }) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      role="img"
      aria-label="Stingy"
      className={`mascot mascot-${motion} ${className}`}
    >
      <g transform="translate(-88.5 -75.5) scale(0.48)">
        <g className="m-whole">
          <g className="m-tail">
            <path d={P.tail} fill="#fff" fillRule="evenodd" />
          </g>
          <g className="m-coinwrap">
            <g className="m-coin">
              <path d={P.blue} fill="#2f6bff" />
              <path d={P.euro} fill="#fff" fillRule="evenodd" />
            </g>
          </g>
          <g className="m-head">
            <path d={P.head} fill="#fff" fillRule="evenodd" />
            <g className="m-eyes">
              {P.eyes.map((d, i) => (
                <path key={i} d={d} fill="#fff" fillRule="evenodd" />
              ))}
            </g>
          </g>
          <g>
            {P.paws.map((d, i) => (
              <path key={i} className="m-paw" d={d} fill="#fff" fillRule="evenodd" />
            ))}
          </g>
          <g>
            {P.sparks.map((d, i) => (
              <path key={i} className="m-spark" d={d} fill="#fff" fillRule="evenodd" />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}
