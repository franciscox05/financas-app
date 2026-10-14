// Saldo de uma conta numa data: usa o snapshot mais recente <= essa data como
// base (se existir) e soma as transações que ainda não estavam refletidas
// nesse valor — assim um snapshot de hoje nunca distorce meses passados
// (datas anteriores ao snapshot nem o veem), e funciona igual para qualquer
// tipo de conta (dinheiro ou investimento). Sem nenhum snapshot, soma todas
// as transações da conta desde sempre (comportamento de sempre).
//
// O corte "já estava refletido no snapshot?" usa `created_at` (quando a
// transação foi guardada), não `occurred_on` (a data do movimento). Se usasse
// a data do movimento, qualquer transação com a MESMA data do snapshot seria
// sempre ignorada — incluindo as que o utilizador regista depois de atualizar
// o saldo, nesse mesmo dia, o que fazia esses registos não afetarem o saldo.
// Com `created_at`, uma transação só é ignorada se já existia antes de o
// snapshot ter sido criado (já estava embutida no valor que a pessoa indicou),
// e qualquer transação nova a partir daí — seja de hoje ou um registo
// histórico adicionado mais tarde — soma-se normalmente por cima.
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
    if (latestSnapshot && new Date(tx.created_at) <= new Date(latestSnapshot.created_at)) continue
    total += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount)
  }
  // Transferências entre contas próprias: não são Gasto/Ganho, mas movem
  // dinheiro de facto — contam no saldo das duas contas envolvidas, com o
  // mesmo corte por snapshot usado acima para as transações normais.
  for (const tr of transfers) {
    if (tr.from_account_id !== accountId && tr.to_account_id !== accountId) continue
    if (tr.occurred_on > asOfDate) continue
    if (latestSnapshot && new Date(tr.created_at) <= new Date(latestSnapshot.created_at)) continue
    if (tr.from_account_id === accountId) total -= Number(tr.amount)
    if (tr.to_account_id === accountId) total += Number(tr.amount)
  }
  return total
}
