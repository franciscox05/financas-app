export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function words(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length >= 3)
}

// Heurística partilhada: entre as transações do mesmo tipo com nota, procura
// a mais recente que partilhe pelo menos uma palavra (>=3 letras, sem
// acentos) com a nota atual. Não usa nenhum serviço externo — só o histórico
// do próprio utilizador, por isso "aprende" com o que ele já registou antes.
function findMostRecentMatch(note, type, transactions) {
  const noteWords = words(note)
  if (noteWords.length === 0) return null

  const candidates = transactions
    .filter((tx) => tx.type === type && tx.note && tx.category_id)
    .map((tx) => ({ tx, txWords: words(tx.note) }))
    .filter(({ txWords }) => txWords.some((w) => noteWords.includes(w)))
    .sort((a, b) => (a.tx.occurred_on < b.tx.occurred_on ? 1 : -1))

  return candidates[0]?.tx ?? null
}

/** Sugere uma categoria com base em transações passadas com nota semelhante. */
export function suggestCategoryId(note, type, transactions) {
  return findMostRecentMatch(note, type, transactions)?.category_id ?? null
}

/** Sugere um valor com base na transação passada mais recente com nota semelhante. */
export function suggestAmount(note, type, transactions) {
  const match = findMostRecentMatch(note, type, transactions)
  return match ? Number(match.amount) : null
}
