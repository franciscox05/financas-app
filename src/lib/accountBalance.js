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

// Há base fiável para o saldo desta conta nesta data?
//
// Sem nenhum snapshot até `asOfDate`, `balanceAt()` arranca do zero e soma
// todas as transações da conta desde sempre — o que não é o saldo desse dia, é
// o fluxo de caixa acumulado. Para o saldo de hoje a diferença passa
// despercebida, mas num gráfico histórico é um valor inventado: uma única
// transação com data antiga (ex.: um empréstimo de 2025 registado agora) entra
// com o peso total em todos os pontos anteriores ao primeiro snapshot e
// afunda-os, enquanto os meses que já têm snapshot ficam intactos.
//
// Uma conta que nunca teve snapshot nenhum é caso diferente: aí a soma desde
// sempre é o único modelo que existe e é o comportamento de sempre (quem só
// registou transações desde o início). Só quem usa snapshots é que tem um
// "antes de haver saldo conhecido".
export function hasReliableBaseline(accountId, snapshots, asOfDate) {
  const own = snapshots.filter((s) => s.account_id === accountId)
  if (own.length === 0) return true
  return own.some((s) => s.snapshot_date <= asOfDate)
}

// Idem para um conjunto de contas (um ponto do gráfico de património): só é
// fiável se todas as contas que já existiam nessa data tiverem base. Uma conta
// criada depois não conta — não ter saldo antes de existir não é falta de dados.
export function groupHasReliableBaseline(accounts, snapshots, asOfDate) {
  return accounts
    .filter((a) => !a.created_at || a.created_at.slice(0, 10) <= asOfDate)
    .every((a) => hasReliableBaseline(a.id, snapshots, asOfDate))
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

// Extrato de uma conta, como nos bancos: cada movimento com o saldo da conta
// ANTES e DEPOIS dele, do mais recente para o mais antigo.
//
// Segue exatamente a regra de `balanceAt()` (e há um teste que o garante: o
// `balanceAfter` do último movimento até `asOfDate` é igual a `balanceAt()`):
// - os acertos de saldo (snapshots) entram na sequência como linhas próprias
//   (`kind: 'snapshot'`) que repõem o saldo no valor indicado; `delta` é a
//   diferença entre o que a app calculava e o valor real indicado;
// - a ordem entre um movimento e um acerto do mesmo dia segue
//   `reflectedInSnapshot()` (data, depois `created_at`; empate = movimento antes);
// - movimentos com data depois de `asOfDate` ficam no fim da sequência
//   (`future: true`): o saldo antes deles é uma projeção, não entra no saldo atual.
// Contas em cêntimos inteiros, para não acumular erros de vírgula flutuante.
export function accountStatement(accountId, transactions, snapshots, asOfDate, transfers = []) {
  const cents = (v) => Math.round(Number(v) * 100)
  const events = []
  for (const tx of transactions) {
    if (tx.account_id !== accountId) continue
    events.push({
      kind: 'transaction',
      item: tx,
      date: tx.occurred_on,
      createdAt: tx.created_at,
      deltaC: tx.type === 'income' ? cents(tx.amount) : -cents(tx.amount),
    })
  }
  for (const tr of transfers) {
    const out = tr.from_account_id === accountId
    const inc = tr.to_account_id === accountId
    if (!out && !inc) continue
    events.push({
      kind: 'transfer',
      item: tr,
      date: tr.occurred_on,
      createdAt: tr.created_at,
      deltaC: (inc ? cents(tr.amount) : 0) - (out ? cents(tr.amount) : 0),
    })
  }
  for (const s of snapshots) {
    if (s.account_id !== accountId) continue
    events.push({ kind: 'snapshot', item: s, date: s.snapshot_date, createdAt: s.created_at, valueC: cents(s.value) })
  }

  events.sort((a, b) => {
    const aFuture = a.date > asOfDate
    const bFuture = b.date > asOfDate
    if (aFuture !== bFuture) return aFuture ? 1 : -1
    if (a.date !== b.date) return a.date < b.date ? -1 : 1
    const ta = new Date(a.createdAt).getTime()
    const tb = new Date(b.createdAt).getTime()
    // Mesmo instante: o movimento vem antes do acerto (reflectedInSnapshot usa `<=`).
    if (ta === tb) return (a.kind === 'snapshot') - (b.kind === 'snapshot')
    return ta - tb
  })

  let runningC = 0
  const lines = []
  for (const e of events) {
    const beforeC = runningC
    if (e.kind === 'snapshot') {
      runningC = e.valueC
      lines.push({ kind: e.kind, item: e.item, date: e.date, future: e.date > asOfDate, delta: (runningC - beforeC) / 100, balanceBefore: beforeC / 100, balanceAfter: runningC / 100 })
    } else {
      runningC += e.deltaC
      lines.push({ kind: e.kind, item: e.item, date: e.date, future: e.date > asOfDate, delta: e.deltaC / 100, balanceBefore: beforeC / 100, balanceAfter: runningC / 100 })
    }
  }
  return lines.reverse()
}

// Chave usada para ligar uma linha da lista do Registo (`movements`: `source` +
// `id`) à linha do extrato.
export function statementKey(kind, id) {
  return `${kind}:${id}`
}
