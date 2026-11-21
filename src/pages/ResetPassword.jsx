import { t } from '../i18n'
import { CheckCircle2, Link2Off, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthScreen, PrimaryButton, SecondaryButton } from '../components/AuthUI'
import NewPasswordStep from '../components/NewPasswordStep'
import { useAuth } from '../context/AuthContext'

// Destino do link de recuperação, para emails antigos (antes do código de 6 dígitos) ou se o
// template do Supabase voltar a ter o link. O supabase-js lê o token do URL e abre a sessão.
export default function ResetPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [done, setDone] = useState(false)

  if (loading) {
    return (
      <AuthScreen stepKey="loading" icon={<Loader2 size={26} className="motion-safe:animate-spin" />} title={t('auth.reset.validating')} />
    )
  }

  if (done) {
    return (
      <AuthScreen
        stepKey="done"
        icon={<CheckCircle2 size={28} />}
        title={t('auth.changed.title')}
        subtitle={t('auth.changed.bodyInstalled')}
        onSubmit={(e) => {
          e.preventDefault()
          navigate('/', { replace: true })
        }}
      >
        <PrimaryButton>{t('auth.changed.continueHere')}</PrimaryButton>
      </AuthScreen>
    )
  }

  if (!user) {
    return (
      <AuthScreen
        stepKey="expired"
        icon={<Link2Off size={26} />}
        title={t('auth.reset.invalidTitle')}
        subtitle={t('auth.reset.invalidBody')}
      >
        <SecondaryButton to="/recuperar-password">{t('auth.reset.newCode')}</SecondaryButton>
      </AuthScreen>
    )
  }

  return <NewPasswordStep onDone={() => setDone(true)} />
}
