// Saldo de uma conta numa data: usa o snapshot mais recente <= essa data como
// base (se existir) e soma só as transações *depois* da data desse snapshot —
// assim um snapshot de hoje nunca distorce meses passados (datas anteriores
// ao snapshot nem o veem), e funciona igual para qualquer tipo de conta
// (dinheiro ou investimento). Sem nenhum snapshot, soma todas as transações
// da conta desde sempre (comportamento de sempre, antes de haver snapshots).
export function balanceAt(accountId, transactions, snapshots, asOfDate) {
  const latestSnapshot = snapshots
    .filter((s) => s.account_id === accountId && s.snapshot_date <= asOfDate)
    .sort((a, b) => (a.snapshot_date < b.snapshot_date ? 1 : -1))[0]

  let total = latestSnapshot ? Number(latestSnapshot.value) : 0
  for (const tx of transactions) {
    if (tx.account_id !== accountId) continue
    if (tx.occurred_on > asOfDate) continue
    if (latestSnapshot && tx.occurred_on <= latestSnapshot.snapshot_date) continue
    total += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
  }
  return total
}
