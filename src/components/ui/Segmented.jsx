// Controlo segmentado: uma calha neutra e a opção escolhida como uma pastilha
// elevada. A cor NÃO identifica a opção escolhida (isso é a pastilha) — o
// `tone` opcional de cada opção só pinta o texto dela quando está ativa
// ('negative' para Gasto, 'positive' para Ganho, 'accent' para Transferência).
//
// A calha tem 44 px de altura para o alvo de toque; a pastilha fica com 36.
const TONE = {
  neutral: 'text-label',
  accent: 'text-accent',
  positive: 'text-positive',
  negative: 'text-negative',
}

export default function Segmented({ options, value, onChange, label, className = '' }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`grid min-h-11 gap-1 rounded-control bg-fill p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`min-w-0 truncate rounded-[0.5625rem] px-2 text-[0.9375rem] transition-[background-color,color,box-shadow] duration-200 ease-apple focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent motion-reduce:transition-none ${
              active
                ? `bg-surface-raised font-semibold shadow-[0_1px_3px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.04)] ${TONE[opt.tone ?? 'neutral']}`
                : 'font-medium text-label-2'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
