import { t } from '../i18n'
import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { AuthAlert, AuthScreen, PasswordField, PrimaryButton, SecondaryButton, TextField } from '../components/AuthUI'
import { useAuth } from '../context/AuthContext'

function signInErrorMessage(error) {
  if (error.code === 'invalid_credentials') return t('auth.err.invalid')
  if (error.code === 'email_not_confirmed') return t('auth.err.notConfirmed')
  if (error.status === 429) return t('auth.err.tooMany')
  return t('auth.err.loginFailed')
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
      setError(t('auth.login.fill'))
      return
    }
    setLoading(true)
    setError('')
    const { error: signInError } = await signIn(email.trim(), password)
    if (signInError) setError(signInErrorMessage(signInError))
    setLoading(false)
  }

  return (
    <AuthScreen stepKey="login" title={t('auth.login.title')} onSubmit={handleSubmit}>
      <div className="space-y-3">
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          label={t('auth.password')}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <AuthAlert key={error}>{error}</AuthAlert>

      <div className="space-y-3">
        <PrimaryButton loading={loading} loadingText={t('auth.login.busy')}>
          {t('auth.login.button')}
        </PrimaryButton>
        <SecondaryButton to="/recuperar-password">
          <KeyRound size={16} aria-hidden="true" />
          {t('auth.login.forgot')}
        </SecondaryButton>
      </div>

      <p className="text-center text-sm text-label-2">
        {t('auth.login.noAccount')}{' '}
        <Link to="/signup" className="font-medium text-accent">
          {t('auth.signup.button')}
        </Link>
      </p>
    </AuthScreen>
  )
}
