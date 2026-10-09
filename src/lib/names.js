import { normalizeText } from './filters'

export const MAX_NAME_LENGTH = 40

// Valida um nome de conta/categoria. `siblings` são os itens contra os quais o
// nome tem de ser único (comparação sem acentos nem maiúsculas); `selfId` exclui
// o próprio item ao renomear. Devolve { name, error } com o nome já normalizado.
export function validateName(rawName, siblings, selfId = null) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ')

  if (!name) return { name, error: 'Indica um nome.' }
  if (name.length > MAX_NAME_LENGTH) {
    return { name, error: `O nome não pode ter mais de ${MAX_NAME_LENGTH} caracteres.` }
  }

  const key = normalizeText(name)
  if (siblings.some((s) => s.id !== selfId && normalizeText(s.name) === key)) {
    return { name, error: 'Já existe um item com este nome.' }
  }
  return { name, error: '' }
}
