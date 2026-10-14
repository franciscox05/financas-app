import { EyeOff } from 'lucide-react'

// Ocupa o lugar de um gráfico enquanto o modo privacidade está ativo.
export default function HiddenChartNotice() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-neutral-400">
      <EyeOff size={20} aria-hidden="true" />
      <p className="text-xs">Valores escondidos</p>
    </div>
  )
}
