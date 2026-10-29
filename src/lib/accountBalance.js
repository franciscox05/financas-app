// Saldo de uma conta numa data: usa o snapshot mais recente <= essa data como
// base (se existir) e soma as transações que ainda não estavam refletidas
// nesse valor — assim um snapshot de hoje nunca distorce meses passados
// (datas anteriores ao snapshot nem o veem), e funciona igual para qualquer
// tipo de conta (dinheiro ou investimento). Sem nenhum snapshot, soma todas
// as transações da conta desde sempre (comportamento de sempre).
//
// "Já estava refletido no snapshot?" — o snapshot é o saldo real NESSE DIA:
// - movimento com data ANTERIOR ao snapshot: já estava incluído no valor
//   indicado, mesmo que só seja registado depois (ex.: um gasto esquecido de
//   dia 10 registado depois de acertar o saldo no dia 19). Antes contava-se
//   outra vez por cima e o saldo ficava a dobrar esse movimento.
// - movimento com data POSTERIOR: conta sempre (mesmo que registado antes de
//   um snapshot com data no passado, ex.: "saldo a 30/09" indicado a 05/10).
// - MESMA data: decide `created_at` — registado antes do snapshot já estava
//   incluído; registado depois (ex.: gasto da tarde depois de acertar de manhã)
//   conta por cima.
export function reflectedInSnapshot(movement, snapshot) {
  if (!snapshot) return false
  if (movement.occurred_on !== snapshot.snapshot_date) return movement.occurred_on < snapshot.snapshot_date
  return new Date(movement.created_at) <= new Date(snapshot.created_at)
}

export function balanceAt(accountId, transactions, snapshots, asOfDate, transfers = []) {
  const latestSnapshot = snapshots
    .filter((s) => s.account_id === accountId && s.snapshot_date <= asOfDate)
    .sort((a, b) => {
      if (a.snapshot_date !== b.snapshot_date) return a.snapshot_date < b.snapshot_date ? 1 : -1
      return new Date(b.created_at) - new Date(a.created_at)
    })[0]

  let total = latestSnapshot ? Number(latestSnapshot.value) : 0
  for (const tx of transactions) {
    if (tx.account_id !== accountId) continue
    if (tx.occurred_on > asOfDate) continue
    if (reflectedInSnapshot(tx, latestSnapshot)) continue
    total +=tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
  }
  // Transferências entre contas próprias: não são Gasto/Ganho, mas movem
  // dinheiro de facto — contam no saldo das duas contas envolvidas, com o
  // mesmo corte por snapshot usado acima para as transações normais.
  for (const tr of transfers) {
    if (tr.from_account_id !== accountId && tr.to_account_id !== accountId) continue
    if (tr.occurred_on > asOfDate) continue
    if (reflectedInSnapshot(tr, latestSnapshot)) continue
    if (tr.from_account_id === accountId) total -= Number(tr.amount)
    if (tr.to_account_id === accountId) total += Number(tr.amount)
  }
  return total
}
