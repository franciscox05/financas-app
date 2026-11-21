import { t } from '../i18n'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './ConfirmDialog'
import { dangerButton } from './ui/styles'

// Terminar sessão — só aqui no Perfil (não espalhado por todas as páginas).
export default function SignOutButton() {
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)

  return (
    <section>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${dangerButton} w-full`}
      >
        {t('signout.button')}
      </button>
      <ConfirmDialog
        open={confirming}
        title={t('signout.q')}
        message={t('signout.msg')}
        confirmLabel={t('signout.button')}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          signOut()
        }}
      />
    </section>
  )
}
