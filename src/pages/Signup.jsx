import { t } from '../i18n'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AuthAlert, AuthScreen, PasswordChecklist, PasswordField, PrimaryButton, SecondaryButton, TextField } from '../components/AuthUI'
import { useAuth } from '../context/AuthContext'
import { checkPassword, passwordErrorMessage } from '../lib/passwordRules'

function signUpErrorMessage(error) {
  if (error.code === 'user_already_exists') return t('auth.err.exists')
  if (error.code === 'weak_password') return passwordErrorMessage(error)
  if (error.status === 429) return t('auth.err.tooMany')
  return t('auth.err.signupFailed')
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
        title={t('auth.signup.confirmTitle')}
        subtitle={t('auth.signup.confirmBody', { email: email.trim() })}
      >
        <SecondaryButton to="/login">{t('auth.signup.toLogin')}</SecondaryButton>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen stepKey="signup" title={t('auth.signup.title')} onSubmit={handleSubmit}>
      <div className="space-y-3">
        <TextField label={t('auth.name')} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <PasswordChecklist password={password} />

      <AuthAlert key={error}>{error}</AuthAlert>

      <PrimaryButton loading={status === 'loading'} loadingText={t('auth.signup.busy')} disabled={!ready}>
        {t('auth.signup.button')}
      </PrimaryButton>

      <p className="text-center text-sm text-label-2">
        Já tens conta?{' '}
        <Link to="/login" className="font-medium text-accent">
          Entrar
        </Link>
      </p>
    </AuthScreen>
  )
}
