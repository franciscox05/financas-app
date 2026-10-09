import { normalize } from './categorySuggest'

/**
 * Aplica o dicionário de regras do utilizador (palavra-chave -> categoria) a
 * uma nota. Usa correspondência por substring (não só palavra inteira), para
 * que uma regra "gas" apanhe "gasolina", "gasóleo" e "gasolina bmw" na mesma
 * categoria, mesmo escritas de forma diferente de mês para mês. Se várias
 * regras combinarem, ganha a palavra-chave mais longa (mais específica).
 */
export function applyCategoryRules(note, type, rules) {
  const noteNorm = normalize(note)
  if (!noteNorm) return null

  const matches = rules
    .filter((r) => r.categories?.type === type)
    .filter((r) => noteNorm.includes(normalize(r.keyword)))
    .sort((a, b) => b.keyword.length - a.keyword.length)

  return matches[0]?.category_id ?? null
}
