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
        Terminar sessão
      </button>
      <ConfirmDialog
        open={confirming}
        title="Terminar sessão?"
        message="Vais ter de entrar novamente para voltar a ver os teus dados."
        confirmLabel="Terminar sessão"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          signOut()
        }}
      />
    </section>
  )
}
