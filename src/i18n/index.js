// Traduções mínimas, sem dependências. Cada idioma é um ficheiro em locales/;
// acrescentar um idioma é acrescentar o ficheiro e uma entrada em LANGUAGES.
// Procura a chave no idioma ativo, depois em inglês, depois em português, e por
// fim devolve a própria chave (nunca rebenta um ecrã por falta de tradução).
import { useSyncExternalStore } from 'react'
import en from './locales/en.js'
import pt from './locales/pt.js'

const DICTIONARIES = { pt, en }

// `ready: true` = traduzido e revisto. Os restantes são os idiomas mais falados
// do mundo: ficam registados para quando houver tradução, mas não se oferecem.
export const LANGUAGES = [
  { code: 'pt', label: 'Português', locale: 'pt-PT', ready: true },
  { code: 'en', label: 'English', locale: 'en-GB', ready: true },
  { code: 'es', label: 'Español', locale: 'es-ES', ready: false },
  { code: 'fr', label: 'Français', locale: 'fr-FR', ready: false },
  { code: 'de', label: 'Deutsch', locale: 'de-DE', ready: false },
  { code: 'zh', label: '中文', locale: 'zh-CN', ready: false },
  { code: 'hi', label: 'हिन्दी', locale: 'hi-IN', ready: false },
  { code: 'ar', label: 'العربية', locale: 'ar', ready: false },
  { code: 'bn', label: 'বাংলা', locale: 'bn-BD', ready: false },
  { code: 'ru', label: 'Русский', locale: 'ru-RU', ready: false },
  { code: 'ur', label: 'اردو', locale: 'ur-PK', ready: false },
  { code: 'id', label: 'Bahasa Indonesia', locale: 'id-ID', ready: false },
  { code: 'ja', label: '日本語', locale: 'ja-JP', ready: false },
]

export const READY_LANGUAGES = LANGUAGES.filter((l) => l.ready)

const STORAGE_KEY = 'stingy.language'
const listeners = new Set()

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && DICTIONARIES[saved]) return saved
  } catch {
    // sem localStorage (modo privado): segue para a deteção por navegador
  }
  const nav = (typeof navigator !== 'undefined' ? navigator.language : '') || ''
  const code = nav.slice(0, 2).toLowerCase()
  return DICTIONARIES[code] ? code : 'pt'
}

let current = detect()

export function getLanguage() {
  return current
}

export function setLanguage(code) {
  if (!DICTIONARIES[code] || code === current) return
  current = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // não guardar não é grave
  }
  listeners.forEach((l) => l())
}

export function languageInfo(code = current) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

export function t(key, vars) {
  const text = DICTIONARIES[current]?.[key] ?? en[key] ?? pt[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`))
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Hook: re-renderiza o componente quando o idioma muda.
export function useT() {
  useSyncExternalStore(subscribe, getLanguage)
  return t
}
