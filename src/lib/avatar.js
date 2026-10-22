// Iniciais para o círculo quando não há foto: 2 primeiras palavras do nome,
// ou a primeira letra do email.
export function avatarInitials(name, email) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}
