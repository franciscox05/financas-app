// Totais de um conjunto de movimentos (normalmente um mês), com empréstimos à
// parte. Uma só regra, usada pelo Registo, pelo Balanço e pelo relatório.
//
//  - Ganhos e Gastos NÃO incluem categorias de empréstimo/devolução
//    (`is_lending`): emprestar a um amigo não é consumo e receber de volta não
//    é rendimento; contá-los inflacionava os dois lados.
//  - Poupança/investimento (`is_savings`) continua dentro dos Gastos (é
//    dinheiro que sai do mês) e vem também à parte em `savings`.
//  - Empréstimos: `lentOut` (emprestado), `lentBack` (recebido de volta) e
//    `lentNet` (o que ficou por receber neste mês: positivo = emprestaste mais
//    do que recebeste).
// Somas em cêntimos: evita "-0,00 €" por vírgula flutuante.
const toCents = (v) => Math.round(Number(v) * 100)

export function monthTotals(txs, categories = []) {
  const lending = new Set(categories.filter((c) => c.is_lending).map((c) => c.id))
  const savings = new Set(categories.filter((c) => c.is_savings).map((c) => c.id))
  let income = 0
  let expense = 0
  let savingsAmount = 0
  let lentOut = 0
  let lentBack = 0
  for (const tx of txs ?? []) {
    const cents = toCents(tx.amount)
    const isLending = lending.has(tx.category_id)
    // Parte dos amigos numa divisão: já saiu do gasto (applyFriendShares) e conta
    // como emprestada, porque o amigo ainda a deve (ou já a devolveu).
    if (tx.friend_share) lentOut += toCents(tx.friend_share)
    if (tx.type === 'income') {
      if (isLending) lentBack += cents
      else income += cents
    } else {
      if (isLending) lentOut += cents
      else {
        expense += cents
        if (savings.has(tx.category_id)) savingsAmount += cents
      }
    }
  }
  return {
    income: income / 100,
    expense: expense / 100,
    savings: savingsAmount / 100,
    lentOut: lentOut / 100,
    lentBack: lentBack / 100,
    lentNet: (lentOut - lentBack) / 100,
  }
}

export function isLendingCategory(categoryId, categories = []) {
  return categories.some((c) => c.id === categoryId && c.is_lending)
}

// Numa despesa dividida com amigos, só a tua parte é gasto teu: a parte do amigo
// (movimento "paguei por ele" ligado à transação) sai do gasto e passa a contar
// como emprestada. `shares` = Map(id da transação -> parte do amigo, em euros).
// Não mexe em categorias de empréstimo/devolução (essas já ficam fora dos gastos).
// Devolve cópias: o valor real da transação na conta nunca muda.
export function applyFriendShares(txs, shares, categories = []) {
  if (!shares || shares.size === 0) return txs ?? []
  const lending = new Set(categories.filter((c) => c.is_lending).map((c) => c.id))
  return (txs ?? []).map((tx) => {
    const share = shares.get(tx.id)
    if (!share || tx.type !== 'expense' || lending.has(tx.category_id)) return tx
    const total = toCents(tx.amount)
    const friend = Math.min(toCents(share), total)
    if (friend <= 0) return tx
    return { ...tx, amount: (total - friend) / 100, friend_share: friend / 100 }
  })
}
