import { Wallet } from 'lucide-react'

export default function AuthBrand({ title }) {
  return (
    <div className="mb-2 flex flex-col items-center gap-3 text-center">
      <span className="flex size-16 items-center justify-center rounded-[1.125rem] bg-accent-fill text-white shadow-[var(--shadow-raised)]">
        <Wallet size={30} strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-label-3">FinancasApp</p>
        <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold tracking-tight text-label">{title}</h1>
      </div>
    </div>
  )
}
