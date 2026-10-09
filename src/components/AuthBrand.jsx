import { Wallet } from 'lucide-react'

export default function AuthBrand({ title }) {
  return (
    <div className="mb-2 flex flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-2xl bg-green-600 text-white">
        <Wallet size={24} />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">FinancasApp</p>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
      </div>
    </div>
  )
}
