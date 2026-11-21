import { t } from '../i18n'
import { ArrowLeft, CheckCircle2, Mail, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthAlert, AuthScreen, OtpInput, PrimaryButton, SecondaryButton, TextField } from '../components/AuthUI'
import NewPasswordStep from '../components/NewPasswordStep'
import { supabase } from '../lib/supabase'

// Tem de bater com Auth → Sign In / Providers → Email → "Email OTP Length" no Supabase.
export const OTP_LENGTH = 6
// O Supabase só deixa pedir um email novo à mesma pessoa de 60 em 60 segundos.
const RESEND_COOLDOWN_S = 60

// Recuperar a password sem sair da app: email → código de 6 dígitos (vem no email) → nova
// password → feito. Um link no email abriria o browser no iPhone em vez da app instalada (o iOS
// não deixa uma PWA "apanhar" links), e a sessão do browser não é a mesma da app.
export default function ForgotPassword() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email') // email | code | password | done
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function sendCode() {
    setLoading(true)
    setError('')
    const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      // Só é usado se o template do email ainda tiver o link em vez do código.
      redirectTo: `${window.location.origin}/nova-password`,
    })
    setLoading(false)
    // A mensagem não diz se a conta existe (senão o ecrã servia para descobrir quem usa a app);
    // só o limite de envios é mostrado, porque aí a pessoa precisa de saber que tem de esperar.
    if (sendError?.status === 429) {
      setError(t('auth.forgot.wait'))
      return false
    }
    setCooldown(RESEND_COOLDOWN_S)
    return true
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('auth.forgot.invalidEmail'))
      return
    }
    if (await sendCode()) {
      setCode('')
      setStep('code')
    }
  }

  async function verify(token) {
    if (token.length !== OTP_LENGTH || loading) return
    setLoading(true)
    setError('')
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: 'recovery' })
    setLoading(false)
    if (verifyError) {
      setCode('')
      setError(
        verifyError.code === 'otp_expired'
          ? t('auth.code.wrong')
          : t('auth.code.failed'),
      )
      return
    }
    setStep('password')
  }

  if (step === 'password') return <NewPasswordStep onDone={() => setStep('done')} />

  if (step === 'done') {
    return (
      <AuthScreen
        stepKey="done"
        icon={<CheckCircle2 size={28} />}
        title={t('auth.changed.title')}
        subtitle={t('auth.changed.bodySession')}
        onSubmit={(e) => {
          e.preventDefault()
          navigate('/', { replace: true })
        }}
      >
        <PrimaryButton>{t('auth.changed.continueApp')}</PrimaryButton>
      </AuthScreen>
    )
  }

  if (step === 'code') {
    return (
      <AuthScreen
        stepKey="code"
        icon={<MailCheck size={26} />}
        title={t('auth.code.title')}
        subtitle={
          <>
            {t('auth.code.sentPre', { n: OTP_LENGTH })} <strong className="font-medium text-label">{email.trim()}</strong>. {t('auth.code.sentPost')}
          </>
        }
        onSubmit={(e) => {
          e.preventDefault()
          verify(code)
        }}
      >
        <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} onComplete={verify} disabled={loading} />

        <AuthAlert key={error}>{error}</AuthAlert>

        <PrimaryButton loading={loading} loadingText={t('auth.code.confirming')} disabled={code.length !== OTP_LENGTH}>
          {t('auth.code.confirm')}
        </PrimaryButton>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => {
              setError('')
              setStep('email')
            }}
            className="rounded-md px-1 py-1 font-medium text-label-2 transition-colors hover:text-label focus-visible:outline-2 focus-visible:outline-accent"
          >
            {t('auth.code.otherEmail')}
          </button>
          <button
            type="button"
            disabled={cooldown > 0 || loading}
            onClick={sendCode}
            className="rounded-md px-1 py-1 font-medium text-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent disabled:text-label-3"
          >
            {cooldown > 0 ? t('auth.code.resendIn', { s: cooldown }) : t('auth.code.resend')}
          </button>
        </div>
      </AuthScreen>
    )
  }

  return (
    <AuthScreen
      stepKey="email"
      icon={<Mail size={26} />}
      title={t('auth.forgot.title')}
      subtitle={t('auth.forgot.body')}
      onSubmit={handleEmailSubmit}
    >
      <TextField
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />

      <AuthAlert key={error}>{error}</AuthAlert>

      <div className="space-y-3">
        <PrimaryButton loading={loading} loadingText={t('auth.forgot.sending')}>
          {t('auth.forgot.send')}
        </PrimaryButton>
        <SecondaryButton to="/login">
          <ArrowLeft size={16} aria-hidden="true" />
          {t('auth.forgot.back')}
        </SecondaryButton>
      </div>
    </AuthScreen>
  )
}
