import { usePrivacy } from '../context/privacyContext'

// Mostra um montante e desfoca-o quando o modo privacidade está ativo.
// Usa `value` (formata como "12.50 €") ou `children` (texto já formatado).
// aria-hidden esconde o valor real aos leitores de ecrã enquanto desfocado.
export default function Money({ value, children, className = '' }) {
  const { hidden } = usePrivacy()
  const text = children ?? `${Number(value).toFixed(2)} €`
  return (
    <span
      className={`transition-[filter] duration-200 ${hidden ? 'select-none blur-sm' : ''} ${className}`.trim()}
      aria-hidden={hidden || undefined}
    >
      {text}
    </span>
  )
}
