import { t } from '../i18n'
import { Plus, X } from 'lucide-react'
import { today } from '../lib/dates'
import { focusRing } from './ui/styles'

// Data opcional que se pode mesmo apagar: o <input type="date"> do iOS preenche o dia de hoje ao
// tocar e não tem como voltar a vazio. Vazio mostra só um botão; com data mostra o campo e um "x".
export default function OptionalDateField({ id, label, value, onChange, addLabel, inputClass }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-label-2">
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
            className={`grid min-h-11 min-w-11 shrink-0 place-items-center rounded-control border border-separator text-label-2 transition duration-150 ease-out hover:bg-fill active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => onChange(today())}
          className={`flex min-h-11 w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-separator px-3 text-sm text-label-2 transition duration-150 ease-out hover:bg-fill active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 ${focusRing}`}
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel ?? t('date.set')}
        </button>
      )}
    </div>
  )
}
