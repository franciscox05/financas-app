import { usePrivacy } from '../context/privacyContext'
import { eur } from '../lib/format'

// Mostra um montante; com o modo privacidade ativo mostra uma máscara fixa
// ("•••• €"), que não revela nem o valor nem quantos dígitos tem.
// Usa `value` (formata como "12,50 €") ou `children` (texto já formatado).
export default function Money({ value, children, mask = '•••• €' }) {
  const { hidden } = usePrivacy()
  if (hidden) {
    return (
      <span className="select-none tracking-wider" role="img" aria-label="Valor escondido">
        {mask}
      </span>
    )
  }
  return <>{children ?? eur(value)}</>
}
