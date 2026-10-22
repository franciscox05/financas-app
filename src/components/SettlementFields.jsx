import { useEffect, useMemo, useState } from 'react'
import { listAccounts, listCategories } from '../lib/db'
import { defaultCategoryId } from '../lib/repaymentInput'

const inputClass =
  'min-h-11 w-full rounded-lg border border-neutral-300 px-3 py-2 transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus-visible:outline-neutral-100'
const labelClass = 'mb-1 block text-xs font-medium text-neutral-500'

const OPTIONS = [
  {
    value: 'bank',
    title: 'Entrou numa conta tua',
    hint: 'Banco, MB Way, ou a tua conta de "Dinheiro" — escolhes qual a seguir',
  },
  { value: 'offset', title: 'Descontado noutra coisa', hint: 'Abate noutra coisa que fizeste por ele' },
]

// "Como foi pago?" para quem aceita uma devolução: forma + (se banco) conta e
// categoria. Entrega `value` ao pai via onChange e diz se já pode submeter.
// `kind` é o tipo do movimento do ponto de vista de quem aceita. `initialSettlement`
// pré-seleciona a opção que o remetente indicou (continua editável).
export default function SettlementFields({ kind, idPrefix, disabled, onChange, initialSettlement = '' }) {
  const [settlement, setSettlement] = useState(initialSettlement)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingLists, setLoadingLists] = useState(false)
  const [listsFailed, setListsFailed] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const type = kind === 'repaid_to_me' ? 'income' : 'expense'
  const categoryOptions = useMemo(() => categories.filter((c) => c.type === type), [categories, type])

  // Só carrega contas/categorias quando escolhe "banco".
  const wantsBank = settlement === 'bank'
  useEffect(() => {
    if (!wantsBank) return
    let cancelled = false
    setLoadingLists(true)
    setListsFailed(false)
    Promise.all([listAccounts(), listCategories()])
      .then(([accs, cats]) => {
        if (cancelled) return
        setAccounts(accs)
        setCategories(cats)
        setAccountId((prev) => prev || (accs[0]?.id ?? ''))
        setCategoryId((prev) => prev || defaultCategoryId(cats, kind))
      })
      .catch(() => {
        if (!cancelled) setListsFailed(true)
      })
      .finally(() => {
        if (!cancelled) setLoadingLists(false)
      })
    return () => {
      cancelled = true
    }
  }, [wantsBank, kind])

  let problem = ''
  if (wantsBank && !loadingLists) {
    if (listsFailed) problem = 'Não foi possível carregar as contas. Tenta outra vez.'
    else if (accounts.length === 0) problem = 'Ainda não tens nenhuma conta. Cria uma primeiro ou escolhe outra forma.'
    else if (categoryOptions.length === 0) {
      problem = `Não tens nenhuma categoria de ${type === 'income' ? 'ganhos' : 'gastos'}. Cria uma primeiro ou escolhe outra forma.`
    }
  }

  const ready =
    settlement === 'offset' || (wantsBank && !loadingLists && !problem && Boolean(accountId) && Boolean(categoryId))

  // Avisa o pai sempre que a escolha muda.
  useEffect(() => {
    onChange({
      ready,
      settlement,
      accountId: wantsBank ? accountId : null,
      categoryId: wantsBank ? categoryId : null,
    })
  }, [ready, settlement, wantsBank, accountId, categoryId, onChange])

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2" disabled={disabled}>
        <legend className={labelClass}>Como foi pago?</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border border-neutral-300 px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-100 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-neutral-900 motion-reduce:transition-none dark:border-neutral-700 dark:has-[:checked]:border-neutral-100 dark:has-[:checked]:bg-neutral-800 dark:has-[:focus-visible]:outline-neutral-100"
          >
            <input
              type="radio"
              name={`${idPrefix}-settlement`}
              value={opt.value}
              checked={settlement === opt.value}
              onChange={() => setSettlement(opt.value)}
              className="mt-1 size-4 accent-neutral-900 dark:accent-neutral-100"
            />
            <span>
              <span className="block font-medium text-neutral-900 dark:text-neutral-100">{opt.title}</span>
              <span className="block text-sm text-neutral-500 dark:text-neutral-400">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {problem && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {problem}
        </p>
      )}

      {wantsBank && !loadingLists && !problem && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor={`${idPrefix}-account`} className={labelClass}>
              Conta
            </label>
            <select
              id={`${idPrefix}-account`}
              value={accountId}
              disabled={disabled}
              onChange={(e) => setAccountId(e.target.value)}
              className={inputClass}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label htmlFor={`${idPrefix}-category`} className={labelClass}>
              Categoria
            </label>
            <select
              id={`${idPrefix}-category`}
              value={categoryId}
              disabled={disabled}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}
            >
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
