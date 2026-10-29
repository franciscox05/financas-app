// Novo saldo de uma conta escrito pelo utilizador (acerto de saldo): aceita
// vírgula ou ponto decimal e arredonda a cêntimos. Ao contrário de um gasto,
// 0 é válido (conta vazia) — mas só se for escrito; caixa vazia devolve null
// (antes `Number('')` dava 0 e um "OK" sem nada escrito zerava a conta).
// Devolve null se vazio, não numérico ou negativo.
export function parseBalanceValue(raw) {
  const text = String(raw ?? '').trim().replace(',', '.')
  if (text === '') return null
  const value = Math.round(Number(text) * 100) / 100
  if (!Number.isFinite(value) || value < 0) return null
  return value
}
