import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { checkPassword, passwordErrorMessage } from '../lib/passwordRules'
import { supabase } from '../lib/supabase'
import { AuthAlert, AuthScreen, PasswordChecklist, PasswordField, PrimaryButton } from './AuthUI'

// Definir a nova password (já com sessão de recuperação aberta, por código ou por link).
// O botão só fica ativo quando todas as regras estão cumpridas, por isso o erro de "password fraca"
// praticamente deixa de aparecer; os que sobram (ex. igual à antiga) chegam num alerta visível.
export default function NewPasswordStep({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const ready = checkPassword(password).valid && password === confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    setLoading(true)
    setError('')
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(passwordErrorMessage(updateError))
      return
    }
    onDone()
  }

  return (
    <AuthScreen
      stepKey="password"
      icon={<KeyRound size={26} />}
      title="Escolhe uma nova password"
      subtitle="Vais usá-la para entrar na FinancasApp a partir de agora."
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <PasswordField
          label="Nova password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <PasswordField
          label="Repetir a nova password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      <PasswordChecklist password={password} confirm={confirm} />

      {/* `key` com a mensagem: o mesmo erro repetido volta a animar (abanão), em vez de ficar parado. */}
      <AuthAlert key={error}>{error}</AuthAlert>

      <PrimaryButton loading={loading} loadingText="A guardar..." disabled={!ready}>
        Guardar nova password
      </PrimaryButton>
    </AuthScreen>
  )
}
