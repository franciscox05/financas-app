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
      className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-label-2"
    >
      {hidden ? (
        <EyeOff size={21} strokeWidth={1.9} aria-hidden="true" className="text-accent" />
      ) : (
        <Eye size={21} strokeWidth={1.9} aria-hidden="true" />
      )}
    </button>
  )
}
