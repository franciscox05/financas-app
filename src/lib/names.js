import { t } from '../i18n/index.js'
import { normalizeText } from './filters'

export const MAX_NAME_LENGTH = 40

// Valida um nome de conta/categoria. `siblings` são os itens contra os quais o
// nome tem de ser único (comparação sem acentos nem maiúsculas); `selfId` exclui
// o próprio item ao renomear. Devolve { name, error } com o nome já normalizado.
export function validateName(rawName, siblings, selfId = null) {
  const name = String(rawName ?? '').trim().replace(/\s+/g, ' ')

  if (!name) return { name, error: t('names.required') }
  if (name.length > MAX_NAME_LENGTH) {
    return { name, error: t('names.tooLong', { n: MAX_NAME_LENGTH }) }
  }

  const key = normalizeText(name)
  if (siblings.some((s) => s.id !== selfId && normalizeText(s.name) === key)) {
    return { name, error: t('names.duplicate') }
  }
  return { name, error: '' }
}
