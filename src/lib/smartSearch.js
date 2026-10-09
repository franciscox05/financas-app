// Interpreta o texto da pesquisa de transações para reconhecer comparações
// de valor e meses/anos, além da pesquisa de texto livre habitual — tudo
// isto aplicado depois no servidor (não em memória), por isso funciona
// sobre todo o histórico, não só sobre o que já estava carregado.

const MONTH_NAME_TO_NUMBER = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

function normalize(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function monthRange(monthNum, year) {
  const from = `${year}-${String(monthNum).padStart(2, '0')}-01`
  const endMonth = monthNum === 12 ? 1 : monthNum + 1
  const endYear = monthNum === 12 ? year + 1 : year
  const to = `${endYear}-${String(endMonth).padStart(2, '0')}-01`
  return { from, to }
}

export function parseSmartQuery(query) {
  const result = { amountOp: null, amountValue: null, dateFrom: null, dateTo: null, textTerms: [] }
  const words = query.trim().split(/\s+/).filter(Boolean)
  const leftover = []

  for (const word of words) {
    const amountMatch = word.match(/^([<>]=?|=)(\d+(?:[.,]\d+)?)$/)
    if (amountMatch && result.amountOp === null) {
      result.amountOp = amountMatch[1]
      result.amountValue = Number(amountMatch[2].replace(',', '.'))
      continue
    }
    leftover.push(word)
  }

  for (let i = 0; i < leftover.length; i++) {
    const monthNum = MONTH_NAME_TO_NUMBER[normalize(leftover[i])]
    if (!monthNum) continue
    let year = new Date().getFullYear()
    let consumed = 1
    const next = leftover[i + 1]
    if (next && /^\d{2,4}$/.test(next)) {
      year = next.length === 2 ? 2000 + Number(next) : Number(next)
      consumed = 2
    }
    const { from, to } = monthRange(monthNum, year)
    result.dateFrom = from
    result.dateTo = to
    leftover.splice(i, consumed)
    break
  }

  if (!result.dateFrom) {
    const yearIdx = leftover.findIndex((w) => /^\d{4}$/.test(w))
    if (yearIdx !== -1) {
      const year = Number(leftover[yearIdx])
      result.dateFrom = `${year}-01-01`
      result.dateTo = `${year + 1}-01-01`
      leftover.splice(yearIdx, 1)
    }
  }

  // Um número isolado sem operador ("20") é tratado como "valor igual a".
  if (result.amountOp === null && leftover.length === 1 && /^\d+(?:[.,]\d+)?$/.test(leftover[0])) {
    result.amountOp = '='
    result.amountValue = Number(leftover[0].replace(',', '.'))
  } else {
    result.textTerms = leftover
  }

  return result
}
