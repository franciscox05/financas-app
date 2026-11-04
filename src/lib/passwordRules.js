// Espelho das regras configuradas no Supabase (Auth → Sign In / Providers → Email):
// mínimo 8 caracteres, com minúsculas, maiúsculas e dígitos. Se mudarem lá, mudar aqui.
export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_RULES = [
  { id: 'length', label: `${PASSWORD_MIN_LENGTH} ou mais caracteres`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: 'lower', label: 'Uma letra minúscula', test: (p) => /[a-z]/.test(p) },
  { id: 'upper', label: 'Uma letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { id: 'digit', label: 'Um número', test: (p) => /\d/.test(p) },
]

// Devolve cada regra com `ok`, para a lista de verificação ao vivo, e se a password cumpre todas.
export function checkPassword(password) {
  const rules = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(password) }))
  return { rules, valid: rules.every((r) => r.ok) }
}

// Traduz os erros do Supabase Auth relacionados com a password para frases curtas e úteis.
export function passwordErrorMessage(error) {
  if (!error) return ''
  switch (error.code) {
    case 'same_password':
      return 'Essa é a password que já tinhas. Escolhe uma diferente.'
    case 'weak_password':
      return 'A password ainda não cumpre todas as regras. Vê a lista acima.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiadas tentativas seguidas. Espera um minuto e tenta outra vez.'
    default:
      return 'Não foi possível guardar a password. Tenta outra vez.'
  }
}
