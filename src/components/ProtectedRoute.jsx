import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { languageInfo, setLanguage } from '../i18n'
import { setFormat } from '../lib/format'
import { getOnboardingState } from '../lib/profileDb'

// Para utilizadores com sessão: carrega o perfil uma vez, aplica o idioma e a
// moeda guardados e manda quem ainda não fez o onboarding para /bem-vindo.
export default function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState(null) // null = a carregar

  useEffect(() => {
    if (!user) return undefined
    let cancelled = false
    getOnboardingState()
      .then((s) => {
        if (cancelled) return
        if (s.locale) {
          setLanguage(s.locale)
          setFormat({ locale: languageInfo(s.locale).locale, currency: s.currency ?? undefined })
        } else if (s.currency) {
          setFormat({ currency: s.currency })
        }
        setState(s)
      })
      .catch(() => {
        if (!cancelled) setState({ onboarded: true })
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!state) return null

  const onOnboarding = location.pathname === '/bem-vindo'
  const preview = new URLSearchParams(location.search).has('ensaio')
  if (!state.onboarded && !onOnboarding) return <Navigate to="/bem-vindo" replace />
  if (state.onboarded && onOnboarding && !preview) return <Navigate to="/" replace />

  return <Outlet />
}
