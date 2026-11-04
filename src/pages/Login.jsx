import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthAlert, AuthScreen, PasswordField, PrimaryButton, SecondaryButton, TextField } from '../components/AuthUI'
import { useAuth } from '../context/AuthContext'

function signInErrorMessage(error) {
  if (error.code === 'invalid_credentials') return 'Email ou password errados. Confirma e tenta outra vez.'
  if (error.code === 'email_not_confirmed') return 'Ainda não confirmaste o email. Vê a tua caixa de entrada.'
  if (error.status === 429) return 'Demasiadas tentativas seguidas. Espera um minuto e tenta outra vez.'
  return 'Não foi possível entrar. Verifica a ligação à internet e tenta outra vez.'
}

export default function Login() {
  const { signIn, user } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Preenche o email e a password.')
      return
    }
    setLoading(true)
    setError('')
    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) setError(signInErrorMessage(signInError))
    setLoading(false)
  }

  return (
    <AuthScreen stepKey="login" title="Entrar" onSubmit={handleSubmit}>
      <div className="space-y-3">
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <AuthAlert key={error}>{error}</AuthAlert>

      <div className="space-y-3">
        <PrimaryButton loading={loading} loadingText="A entrar...">
          Entrar
        </PrimaryButton>
        <SecondaryButton to="/recuperar-password">
          <KeyRound size={16} aria-hidden="true" />
          Esqueci-me da password
        </SecondaryButton>
      </div>

      <p className="text-center text-sm text-neutral-500">
        Ainda não tens conta?{' '}
        <Link to="/signup" className="font-medium text-green-600 hover:text-green-700">
          Criar conta
        </Link>
      </p>
    </AuthScreen>
  )
}
