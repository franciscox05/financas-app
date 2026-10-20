// Valor de um gasto escrito pelo utilizador: aceita vírgula ou ponto decimal,
// arredonda a cêntimos inteiros. Devolve null se vazio, não numérico, <= 0.
export function parseExpenseAmount(raw) {
  const text = String(raw ?? '').trim().replace(',', '.')
  if (text === '') return null
  const value = Math.round(Number(text) * 100) / 100
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}
