import { Check, ChevronLeft, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import mascot from '../assets/mascote.svg'
import { inputClass, labelClass, primaryButton, secondaryButton } from '../components/ui/styles'
import { READY_LANGUAGES, getLanguage, languageInfo, setLanguage, t, useT } from '../i18n'
import { parseBalanceValue } from '../lib/balanceInput'
import { clearAccountsAndCategoriesCache } from '../lib/db'
import { getFormat, setFormat } from '../lib/format'
import { CURRENCIES, TEMPLATE_IDS, buildCategories, suggestAccounts } from '../lib/onboardingTemplates'
import { completeOnboarding } from '../lib/profileDb'

const GOALS = ['track', 'save', 'friends', 'invest']
const STEPS = ['welcome', 'lang', 'goals', 'accounts', 'template', 'done']

// Moeda por defeito conforme o idioma escolhido (o utilizador pode mudar).
const DEFAULT_CURRENCY = { pt: 'EUR', en: 'USD' }

function currencyName(code, language) {
  try {
    return new Intl.DisplayNames([languageInfo(language).locale], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

function Choice({ selected, onClick, title, description, multi = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`pressable flex min-h-14 w-full items-center gap-3 rounded-group px-4 py-3 text-left ${
        selected ? 'bg-accent/12 ring-2 ring-accent' : 'bg-surface'
      }`}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center ${multi ? 'rounded-md' : 'rounded-full'} ${
          selected ? 'bg-accent-fill text-white' : 'border border-label-3'
        }`}
        aria-hidden="true"
      >
        {selected && <Check size={15} strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[1.0625rem] leading-snug font-medium text-label">{title}</span>
        {description && <span className="block text-[0.8125rem] leading-snug text-label-2">{description}</span>}
      </span>
    </button>
  )
}

export default function Onboarding() {
  useT() // re-renderiza ao mudar de idioma
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const preview = params.has('ensaio')

  const initial = useRef({ language: getLanguage(), format: getFormat() })
  const [step, setStep] = useState(0)
  const [language, setLanguageState] = useState(getLanguage())
  const [currency, setCurrency] = useState(initial.current.format.currency)
  const [goals, setGoals] = useState(['track'])
  const [accounts, setAccounts] = useState([])
  const [accountsTouched, setAccountsTouched] = useState(false)
  const [template, setTemplate] = useState('basic')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Em pré-visualização, ao sair repõe o idioma e a moeda que a pessoa tinha.
  useEffect(() => {
    if (!preview) return undefined
    const { language: lang0, format: fmt0 } = initial.current
    return () => {
      setLanguage(lang0)
      setFormat(fmt0)
    }
  }, [preview])

  function chooseLanguage(code) {
    setLanguageState(code)
    setLanguage(code)
    const nextCurrency = DEFAULT_CURRENCY[code] ?? currency
    setCurrency(nextCurrency)
    setFormat({ locale: languageInfo(code).locale, currency: nextCurrency })
  }

  function chooseCurrency(code) {
    setCurrency(code)
    setFormat({ locale: languageInfo(language).locale, currency: code })
  }

  function toggleGoal(goal) {
    setGoals((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]))
    setAccountsTouched(false)
  }

  // Ao entrar nas contas, sugere-as a partir dos objetivos (se ainda não mexeu nelas).
  useEffect(() => {
    if (STEPS[step] !== 'accounts' || accountsTouched) return
    setAccounts(
      suggestAccounts(goals).map((a) => ({ id: a.id, name: t(a.nameKey), type: a.type, balance: '' })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao entrar no passo
  }, [step])

  function updateAccount(id, patch) {
    setAccountsTouched(true)
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  const categories = useMemo(
    () => buildCategories(template, goals, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `language` muda os nomes
    [template, goals, language],
  )

  const validAccounts = accounts.filter((a) => a.name.trim())
  const stepName = STEPS[step]
  const total = STEPS.length - 1 // sem contar o ecrã final no "Passo n de N"
  const canContinue = stepName !== 'accounts' || validAccounts.length > 0

  async function finish() {
    if (preview) {
      navigate('/', { replace: true })
      return
    }
    setSaving(true)
    setError('')
    try {
      await completeOnboarding({
        locale: language,
        currency,
        preferences: { goals, template },
        accounts: validAccounts.map((a) => ({
          name: a.name.trim(),
          type: a.type,
          opening_balance: parseBalanceValue(a.balance) ?? 0,
        })),
        categories,
      })
      clearAccountsAndCategoriesCache()
      // Recarrega para o resto da app arrancar já com o perfil, o idioma e a moeda novos.
      window.location.assign('/')
    } catch (err) {
      setError(t('onb.error', { message: err.message }))
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-dvh justify-center bg-canvas">
      <div className="flex w-full max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
        <header className="flex min-h-11 items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="pressable -ml-2 flex min-h-11 items-center gap-0.5 rounded-control px-2 text-accent"
            >
              <ChevronLeft size={20} aria-hidden="true" /> {t('onb.back')}
            </button>
          ) : (
            <span />
          )}
          {step > 0 && stepName !== 'done' && (
            <span className="text-[0.8125rem] text-label-2">{t('onb.step', { n: step, total: total - 1 })}</span>
          )}
        </header>

        {preview && (
          <p className="mt-1 rounded-control bg-warning/15 px-3 py-2 text-[0.8125rem] text-warning">{t('onb.preview')}</p>
        )}

        <main className="flex flex-1 flex-col gap-6 py-6">
          {stepName === 'welcome' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
              <img src={mascot} alt="" className="size-40" />
              <div className="space-y-2">
                <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-label">{t('onb.welcome.title')}</h1>
                <p className="text-[1.0625rem] leading-snug text-label-2">{t('onb.welcome.body')}</p>
              </div>
            </div>
          )}

          {stepName === 'lang' && (
            <>
              <Heading title={t('onb.lang.title')} body={t('onb.lang.body')} />
              <div className="space-y-2">
                <p className={labelClass}>{t('onb.lang.language')}</p>
                {READY_LANGUAGES.map((l) => (
                  <Choice key={l.code} selected={language === l.code} onClick={() => chooseLanguage(l.code)} title={l.label} />
                ))}
                <p className="px-1 text-[0.8125rem] text-label-3">{t('onb.lang.more')}</p>
              </div>
              <div>
                <label htmlFor="onb-currency" className={labelClass}>
                  {t('onb.lang.currency')}
                </label>
                <select
                  id="onb-currency"
                  value={currency}
                  onChange={(e) => chooseCurrency(e.target.value)}
                  className={inputClass}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c} · {currencyName(c, language)}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {stepName === 'goals' && (
            <>
              <Heading title={t('onb.goals.title')} body={t('onb.goals.body')} />
              <div className="space-y-2">
                {GOALS.map((g) => (
                  <Choice key={g} multi selected={goals.includes(g)} onClick={() => toggleGoal(g)} title={t(`onb.goals.${g}`)} />
                ))}
              </div>
            </>
          )}

          {stepName === 'accounts' && (
            <>
              <Heading title={t('onb.accounts.title')} body={t('onb.accounts.body')} />
              <div className="space-y-3">
                {accounts.map((a) => (
                  <div key={a.id} className="space-y-2 rounded-group bg-surface p-3">
                    <div className="flex items-center gap-2">
                      <input
                        aria-label={t('onb.accounts.name')}
                        value={a.name}
                        onChange={(e) => updateAccount(a.id, { name: e.target.value })}
                        maxLength={60}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAccountsTouched(true)
                          setAccounts((prev) => prev.filter((x) => x.id !== a.id))
                        }}
                        aria-label={t('onb.accounts.remove', { name: a.name })}
                        className="pressable flex size-11 shrink-0 items-center justify-center rounded-full text-label-3"
                      >
                        <X size={18} aria-hidden="true" />
                      </button>
                    </div>
                    <input
                      aria-label={t('onb.accounts.balance')}
                      placeholder={t('onb.accounts.balance')}
                      inputMode="decimal"
                      value={a.balance}
                      onChange={(e) => updateAccount(a.id, { balance: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                ))}
                {accounts.length === 0 && <p className="text-[0.9375rem] text-negative">{t('onb.accounts.empty')}</p>}
                <button
                  type="button"
                  onClick={() => {
                    setAccountsTouched(true)
                    setAccounts((prev) => [
                      ...prev,
                      { id: `custom-${Date.now()}`, name: t('onb.accounts.new'), type: 'cash', balance: '' },
                    ])
                  }}
                  className={`${secondaryButton} flex w-full items-center justify-center gap-1.5`}
                >
                  <Plus size={18} aria-hidden="true" /> {t('onb.accounts.add')}
                </button>
              </div>
            </>
          )}

          {stepName === 'template' && (
            <>
              <Heading title={t('onb.tpl.title')} body={t('onb.tpl.body')} />
              <div className="space-y-2">
                {TEMPLATE_IDS.map((id) => (
                  <Choice
                    key={id}
                    selected={template === id}
                    onClick={() => setTemplate(id)}
                    title={t(`onb.tpl.${id}`)}
                    description={t(`onb.tpl.${id}.desc`)}
                  />
                ))}
              </div>
              <p className="px-1 text-[0.8125rem] text-label-2">{t('onb.tpl.preview', { count: categories.length })}</p>
            </>
          )}

          {stepName === 'done' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
              <img src={mascot} alt="" className="size-32" />
              <Heading title={t('onb.done.title')} body={t('onb.done.body')} centered />
              <ul className="w-full space-y-1 rounded-group bg-surface p-4 text-left text-[0.9375rem] text-label">
                <li>{t('onb.done.accounts', { count: validAccounts.length })}</li>
                <li>{t('onb.done.categories', { count: categories.length })}</li>
                <li>{t('onb.done.lang', { language: languageInfo(language).label, currency })}</li>
              </ul>
              {error && <p role="alert" className="text-[0.9375rem] text-negative">{error}</p>}
            </div>
          )}
        </main>

        <footer className="space-y-2">
          {stepName === 'done' ? (
            <button type="button" onClick={finish} disabled={saving} className={`${primaryButton} w-full`}>
              {saving ? t('onb.saving') : t('onb.finish')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue}
                className={`${primaryButton} w-full`}
              >
                {stepName === 'welcome' ? t('onb.welcome.cta') : t('onb.next')}
              </button>
              {stepName === 'goals' && (
                <button type="button" onClick={() => setStep((s) => s + 1)} className="min-h-11 w-full text-[0.9375rem] text-label-2">
                  {t('onb.skip')}
                </button>
              )}
            </>
          )}
        </footer>
      </div>
    </div>
  )
}

function Heading({ title, body, centered = false }) {
  return (
    <div className={`space-y-1.5 ${centered ? 'text-center' : ''}`}>
      <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-label">{title}</h1>
      <p className="text-[1.0625rem] leading-snug text-label-2">{body}</p>
    </div>
  )
}
