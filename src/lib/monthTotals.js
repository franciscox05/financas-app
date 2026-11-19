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
