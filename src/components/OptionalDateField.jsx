import { Plus, X } from 'lucide-react'
import { today } from '../lib/dates'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

// Data opcional que se pode mesmo apagar: o <input type="date"> do iOS preenche o dia de hoje ao
// tocar e não tem como voltar a vazio. Vazio mostra só um botão; com data mostra o campo e um "x".
export default function OptionalDateField({ id, label, value, onChange, addLabel = 'Definir data', inputClass }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-neutral-500">
        {label}
      </label>
      {value ? (
        <div className="flex gap-2">
          <input
            id={id}
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={`Remover: ${label}`}
            className={`grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-neutral-300 text-neutral-500 transition duration-150 ease-out hover:bg-neutral-100 active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-neutral-700 dark:hover:bg-neutral-800 ${focusRing}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => onChange(today())}
          className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-neutral-300 px-3 text-sm text-neutral-500 transition duration-150 ease-out hover:bg-neutral-100 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 dark:border-neutral-700 dark:hover:bg-neutral-800 ${focusRing}`}
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  )
}
