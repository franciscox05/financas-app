import { Eye, EyeOff } from 'lucide-react'
import { usePrivacy } from '../context/privacyContext'

export default function PrivacyToggle() {
  const { hidden, toggle } = usePrivacy()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}
      className="rounded-lg border border-neutral-300 p-1.5 dark:border-neutral-700"
    >
      {hidden ? (
        <EyeOff size={16} className="text-neutral-400" />
      ) : (
        <Eye size={16} className="text-neutral-400" />
      )}
    </button>
  )
}
