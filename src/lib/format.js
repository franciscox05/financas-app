// Formatação de montantes. Único sítio onde se formata dinheiro — evita cada
// ecrã ter o seu toFixed(2), que dava "483.83 €" (ponto decimal, estilo inglês).
// O idioma e a moeda vêm do perfil (onboarding); por defeito pt-PT e euro:
// "483,83 €". O nome `eur` mantém-se por compatibilidade, mas formata na moeda
// ativa.
let activeLocale = 'pt-PT'
let activeCurrency = 'EUR'
let fmt = build()

function build() {
  return {
    currency: new Intl.NumberFormat(activeLocale, { style: 'currency', currency: activeCurrency }),
    cents: new Intl.NumberFormat(activeLocale, { style: 'currency', currency: activeCurrency, minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    whole: new Intl.NumberFormat(activeLocale, { style: 'currency', currency: activeCurrency, minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  }
}

// Muda o idioma de formatação e a moeda (ex.: ao carregar o perfil).
export function setFormat({ locale, currency } = {}) {
  try {
    const nextLocale = locale || activeLocale
    const nextCurrency = currency || activeCurrency
    new Intl.NumberFormat(nextLocale, { style: 'currency', currency: nextCurrency })
    activeLocale = nextLocale
    activeCurrency = nextCurrency
    fmt = build()
  } catch {
    // locale ou moeda inválidos: mantém o que estava
  }
}

export function getFormat() {
  return { locale: activeLocale, currency: activeCurrency }
}

// Símbolo da moeda ativa ("€", "$", "R$"), para rótulos como "Valor (€)".
export function currencySymbol() {
  return fmt.currency.formatToParts(0).find((p) => p.type === 'currency')?.value ?? activeCurrency
}

export function eur(value) {
  const n = Number(value)
  // Zero normalizado: somas em vírgula flutuante dão -5.5e-17 e o Intl mostraria "-0,00 €".
  return fmt.currency.format(Math.abs(n) < 0.005 ? 0 : n)
}

// Montante com sinal explícito ("+479,02 €" / "-11,06 €"), para saldos e totais.
export function eurSigned(value) {
  const n = Number(value)
  const sign = Math.abs(n) < 0.005 ? '' : n < 0 ? '-' : '+'
  return `${sign}${eur(Math.abs(n))}`
}

// Versão compacta para as células do calendário, onde há pouco espaço: com
// cêntimos abaixo de 100 ("-11,06€", "-0,79€") e inteiros a partir daí
// ("-209€"), onde os cêntimos já não mudam nada. Sem arredondar a pequenos
// gastos para "-0€". Com `signed`, os valores positivos levam "+".
export function eurCompact(value, { signed = false } = {}) {
  const n = Number(value)
  const abs = Math.abs(n)
  const body = (abs < 100 ? fmt.cents : fmt.whole).format(abs).replace(/\s/g, '')
  const isZero = abs < 0.005
  const sign = isZero ? '' : n < 0 ? '-' : signed ? '+' : ''
  return `${sign}${body}`
}

// 'YYYY-MM-DD' -> '29/10/2026', sem passar por Date (sem desvios de fuso).
export function ptDate(iso) {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// 'YYYY-MM-DD' -> '19 out' (ou '19 out 2026' com `withYear`), sem passar por
// Date, para não haver desvios de fuso.
export function shortDate(iso, { withYear = false } = {}) {
  const [year, month, day] = iso.split('-').map(Number)
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`
}
