import { t } from '../i18n'
import { useEffect, useMemo, useState } from 'react'
import { listAccounts, listCategories } from '../lib/db'
import { defaultCategoryId } from '../lib/repaymentInput'
import { inputClass, labelClass } from './ui/styles'

const OPTIONS = [
  {
    value: 'bank',
    titleKey: 'sheet.intoYourAccount',
    hintKey: 'sheet.intoYourAccountHint',
  },
  { value: 'offset', titleKey: 'sheet.offset', hintKey: 'sheet.offsetHint' },
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
    if (listsFailed) problem = t('sheet.accountsFailed')
    else if (accounts.length === 0) problem = t('sheet.noAccounts')
    else if (categoryOptions.length === 0) {
      problem = t(type === 'income' ? 'sheet.noIncomeCategory' : 'sheet.noExpenseCategory')
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
        <legend className={labelClass}>{t('sheet.howPaid')}</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className="flex min-h-14 cursor-pointer items-start gap-3 rounded-control border border-separator px-3 py-2.5 transition-colors duration-150 ease-out has-[:checked]:border-accent has-[:checked]:bg-accent/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent motion-reduce:transition-none"
          >
            <input
              type="radio"
              name={`${idPrefix}-settlement`}
              value={opt.value}
              checked={settlement === opt.value}
              onChange={() => setSettlement(opt.value)}
              className="mt-1 size-4 accent-accent"
            />
            <span>
              <span className="block font-medium text-label">{t(opt.titleKey)}</span>
              <span className="block text-sm text-label-2">{t(opt.hintKey)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {problem && (
        <p role="alert" className="text-sm text-negative">
          {problem}
        </p>
      )}

      {wantsBank && !loadingLists && !problem && (
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor={`${idPrefix}-account`} className={labelClass}>
              {t('common.account')}
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
              {t('common.category')}
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
