import { useState } from 'react'
import { useToast } from '../context/toastContext'
import { READY_LANGUAGES, getLanguage, languageInfo, setLanguage, useT } from '../i18n'
import { getFormat, setFormat } from '../lib/format'
import { CURRENCIES } from '../lib/onboardingTemplates'
import { saveLocalePreferences } from '../lib/profileDb'
import { focusRing, inputClass, labelClass } from './ui/styles'

function currencyName(code, language) {
  try {
    return new Intl.DisplayNames([languageInfo(language).locale], { type: 'currency' }).of(code) ?? code
  } catch {
    return code
  }
}

// Perfil → Idioma e moeda. Muda logo no ecrã e guarda no perfil (é o que
// ProtectedRoute volta a aplicar quando se entra noutro aparelho).
export default function LanguageSection() {
  const t = useT()
  const toast = useToast()
  const language = getLanguage()
  const [currency, setCurrency] = useState(getFormat().currency)
  const [busy, setBusy] = useState(false)

  async function save(nextLanguage, nextCurrency) {
    const previous = { language, currency }
    setLanguage(nextLanguage)
    setFormat({ locale: languageInfo(nextLanguage).locale, currency: nextCurrency })
    setCurrency(nextCurrency)
    setBusy(true)
    try {
      await saveLocalePreferences({ locale: nextLanguage, currency: nextCurrency })
      toast.success(t('lang.saved'))
    } catch {
      // Volta atrás para o ecrã não mostrar uma coisa e o perfil guardar outra.
      setLanguage(previous.language)
      setFormat({ locale: languageInfo(previous.language).locale, currency: previous.currency })
      setCurrency(previous.currency)
      toast.error(t('lang.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <p className={labelClass}>{t('lang.language')}</p>
        <div role="radiogroup" aria-label={t('lang.language')} className="space-y-2">
          {READY_LANGUAGES.map((l) => {
            const selected = language === l.code
            return (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={busy}
                onClick={() => !selected && save(l.code, currency)}
                className={`flex min-h-12 w-full items-center justify-between rounded-control border px-3.5 text-left text-[1.0625rem] transition-colors duration-150 disabled:opacity-60 ${focusRing} ${
                  selected ? 'border-accent bg-accent/10 font-semibold text-label' : 'border-separator text-label-2'
                }`}
              >
                {l.label}
                {selected && <span className="text-accent">✓</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div>
        <label htmlFor="profile-currency" className={labelClass}>
          {t('lang.currency')}
        </label>
        <select
          id="profile-currency"
          value={currency}
          disabled={busy}
          onChange={(e) => save(language, e.target.value)}
          className={inputClass}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} · {currencyName(c, language)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[0.8125rem] text-label-3">{t('lang.currencyHelp')}</p>
      </div>
    </div>
  )
}
