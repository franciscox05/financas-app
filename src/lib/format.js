// Formatação de montantes em pt-PT (vírgula decimal): "483,83 €".
// Único sítio onde se formata dinheiro — evita cada ecrã ter o seu toFixed(2),
// que dava "483.83 €" (ponto decimal, estilo inglês).
const eurFormatter = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })

export function eur(value) {
  return eurFormatter.format(Number(value))
}

// Montante com sinal explícito ("+479,02 €" / "-11,06 €"), para saldos e totais.
export function eurSigned(value) {
  const n = Number(value)
  const sign = Math.abs(n) < 0.005 ? '' : n < 0 ? '-' : '+'
  return `${sign}${eur(Math.abs(n))}`
}

const centsFormatter = new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const wholeFormatter = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 })

// Versão compacta para as células do calendário, onde há pouco espaço: com
// cêntimos abaixo de 100 € ("-11,06€", "-0,79€") e em euros inteiros a partir
// daí ("-209€"), onde os cêntimos já não mudam nada. Sem arredondar a
// pequenos gastos para "-0€". Com `signed`, os valores positivos levam "+".
export function eurCompact(value, { signed = false } = {}) {
  const n = Number(value)
  const abs = Math.abs(n)
  const body = abs < 100 ? centsFormatter.format(abs) : wholeFormatter.format(abs)
  const isZero = abs < 0.005
  const sign = isZero ? '' : n < 0 ? '-' : signed ? '+' : ''
  return `${sign}${body}€`
}
