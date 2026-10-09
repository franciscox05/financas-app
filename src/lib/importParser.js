// Extrai transações do formato de texto que o Francisco usava nas Notas do
// iPhone: "Dia N ±valor€ descrição", uma por linha. Tudo o resto (cabeçalho
// do mês, bloco de resumo manual com Rendimentos/Gastos/Balanço) é ignorado
// de propósito — não corresponde ao padrão, por isso nunca entra na lista.

const LINE_PATTERN = /^Dia\s+(\d{1,2})\s*([+-])\s*(\d+(?:[.,]\d+)?)\s*€?\s*(.*)$/i

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
