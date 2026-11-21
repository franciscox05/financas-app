import { t } from '../i18n/index.js'
// Espelho das regras configuradas no Supabase (Auth → Sign In / Providers → Email):
// mínimo 8 caracteres, com minúsculas, maiúsculas e dígitos. Se mudarem lá, mudar aqui.
export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_RULES = [
  { id: 'length', labelKey: 'pw.rule.length', test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', labelKey: 'pw.rule.lower', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', labelKey: 'pw.rule.upper', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', labelKey: 'pw.rule.digit', test: (p) => /\d/.test(p) },
]

// Devolve cada regra com `ok`, para a lista de verificação ao vivo, e se a password cumpre todas.
export function checkPassword(password) {
  const rules = PASSWORD_RULES.map((r) => ({ id: r.id, label: t(r.labelKey, { n: PASSWORD_MIN_LENGTH }), ok: r.test(password) }))
  return { rules, valid: rules.every((r) => r.ok) }
}

// Traduz os erros do Supabase Auth relacionados com a password para frases curtas e úteis.
export function passwordErrorMessage(error) {
  if (!error) return ''
  switch (error.code) {
    case 'same_password':
      return t('pw.err.same')
    case 'weak_password':
      return t('pw.err.weak')
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('auth.err.tooMany')
    default:
      return t('pw.err.failed')
  }
}
