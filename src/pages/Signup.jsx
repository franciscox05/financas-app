import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthAlert, AuthScreen, PasswordChecklist, PasswordField, PrimaryButton, SecondaryButton, TextField } from '../components/AuthUI'
import { useAuth } from '../context/AuthContext'
import { checkPassword, passwordErrorMessage } from '../lib/passwordRules'

function signUpErrorMessage(error) {
  if (error.code === 'user_already_exists') return 'Já existe uma conta com esse email. Entra ou recupera a password.'
  if (error.code === 'weak_password') return passwordErrorMessage(error)
  if (error.status === 429) return 'Demasiadas tentativas seguidas. Espera um minuto e tenta outra vez.'
  return 'Não foi possível criar a conta. Tenta outra vez.'
}

export default function Signup() {
  const { signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | sent | loggedIn | error
  const [error, setError] = useState('')
  const ready = fullName.trim() && email.trim() && checkPassword(password).valid

  async function handleSubmit(e) {
    e.preventDefault()
    if (!ready) return
    setStatus('loading')
    setError('')
    const { data, error: signUpError } = await signUp(email.trim(), password, fullName.trim())
    if (signUpError) {
      setError(signUpErrorMessage(signUpError))
      setStatus('error')
      return
    }
    // Com "Confirm email" desativado no Supabase, o signup já devolve sessão ativa.
    setStatus(data.session ? 'loggedIn' : 'sent')
  }

  if (status === 'loggedIn') return <Navigate to="/" replace />

  if (status === 'sent') {
    return (
      <AuthScreen
        stepKey="sent"
        icon={<MailCheck size={26} />}
        title="Confirma o teu email"
        subtitle={`Conta criada. Enviámos um email para ${email.trim()} — confirma-o antes de entrares.`}
      >
        <SecondaryButton to="/login">Ir para o início de sessão</SecondaryButton>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen stepKey="signup" title="Criar conta" onSubmit={handleSubmit}>
      <div className="space-y-3">
        <TextField label="Nome" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="nome@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <PasswordChecklist password={password} />

      <AuthAlert key={error}>{error}</AuthAlert>

      <PrimaryButton loading={status === 'loading'} loadingText="A criar..." disabled={!ready}>
        Criar conta
      </PrimaryButton>

      <p className="text-center text-sm text-neutral-500">
        Já tens conta?{' '}
        <Link to="/login" className="font-medium text-green-600 hover:text-green-700">
          Entrar
        </Link>
      </p>
    </AuthScreen>
  )
}
