// Extrai transações do formato de texto que o Francisco usava nas Notas do
// iPhone: "Dia N ±valor€ descrição", uma por linha. Tudo o resto (cabeçalho
// do mês, bloco de resumo manual com Rendimentos/Gastos/Balanço) é ignorado
// de propósito — não corresponde ao padrão, por isso nunca entra na lista.

const LINE_PATTERN = /^Dia\s+(\d{1,2})\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*€?\s*(.*)$/i

const MONTH_NAME_TO_NUMBER = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
}

function normalizeSimple(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

// Deteta o cabeçalho do mês ("Maio 25", "Junho 26") no texto colado, para
// usar como fonte de verdade em vez de confiar só no dropdown de mês/ano —
// que pode voltar ao mês atual por defeito se a app recarregar/reiniciar
// entretanto (já aconteceu: Maio 2025 foi importado como Outubro 2026
// porque o dropdown tinha voltado ao mês corrente sem o utilizador notar).
export function detectMonthHeader(text) {
  for (const line of text.split('\n')) {
    const match = line.trim().match(/^([A-Za-zÀ-ÿ]+)\s+(\d{2})$/)
    if (!match) continue
    const monthNum = MONTH_NAME_TO_NUMBER[normalizeSimple(match[1])]
    if (!monthNum) continue
    return { month: monthNum, year: 2000 + Number(match[2]) }
  }
  return null
}

export function parseMonthText(text) {
  const lines = text.split('\n')
  const parsed = []
  for (const line of lines) {
    const match = line.trim().match(LINE_PATTERN)
    if (!match) continue
    const [, day, sign, amountText, note] = match
    parsed.push({
      day: Number(day),
      sign,
      amount: Number(amountText.replace(',', '.')),
      note: note.trim(),
    })
  }
  return parsed
}

export function buildImportRows(parsed, year, month) {
  return parsed.map((entry) => ({
    occurredOn: `${year}-${String(month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`,
    type: entry.sign === '+' ? 'income' : 'expense',
    amount: entry.amount,
    note: entry.note,
  }))
}
