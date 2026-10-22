import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import ConfirmDialog from './ConfirmDialog'

// Terminar sessão — só aqui no Perfil (não espalhado por todas as páginas).
export default function SignOutButton() {
  const { signOut } = useAuth()
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 w-full rounded-lg border border-neutral-300 px-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
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
