import { Suspense, lazy, useEffect } from 'react'
import { MascotSplash } from './components/MascotTile'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'
import { AuthProvider } from './context/AuthContext'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import { isRecoveryLink } from './lib/supabase'

// Carregamento por partes: o Registo (ecrã inicial) e o Login vão no arranque; o resto
// (gráficos, importadores, etc.) só quando é preciso. Antes ia tudo num ficheiro de 1,6 MB.
// Cada `import()` fica numa função para poder ser pedido antes da navegação (ver
// `preloadPages`), e o `lazy` reutiliza o mesmo pedido.
const pages = {
  AccountHistory: () => import('./pages/AccountHistory'),
  Balance: () => import('./pages/Balance'),
  FriendLedger: () => import('./pages/FriendLedger'),
  Friends: () => import('./pages/Friends'),
  Manage: () => import('./pages/Manage'),
  Onboarding: () => import('./pages/Onboarding'),
  NetWorth: () => import('./pages/NetWorth'),
  Profile: () => import('./pages/Profile'),
  ResetPassword: () => import('./pages/ResetPassword'),
  Signup: () => import('./pages/Signup'),
  ForgotPassword: () => import('./pages/ForgotPassword'),
}
const AccountHistory = lazy(pages.AccountHistory)
const Balance = lazy(pages.Balance)
const FriendLedger = lazy(pages.FriendLedger)
const Friends = lazy(pages.Friends)
const Manage = lazy(pages.Manage)
const Onboarding = lazy(pages.Onboarding)
const NetWorth = lazy(pages.NetWorth)
const Profile = lazy(pages.Profile)
const ResetPassword = lazy(pages.ResetPassword)
const Signup = lazy(pages.Signup)
const ForgotPassword = lazy(pages.ForgotPassword)

// Depois do arranque, pede os separadores principais em segundo plano, para que trocar de
// separador continue instantâneo. Falhas aqui não importam: o `lazy` volta a pedir.
function preloadPages() {
  const run = () => {
    for (const load of [pages.Balance, pages.NetWorth, pages.Friends, pages.Manage, pages.Profile]) {
      load().catch(() => {})
    }
  }
  if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1500)
}

// Um link de recuperação que chegue a outra rota (ver isRecoveryLink) vai sempre parar à página
// de nova password — com a sessão temporária aberta, senão entrava-se na app sem a mudar.
// Só uma vez, ao abrir a app: depois de guardar a password, ir para "/" não pode voltar a cair aqui.
function RecoveryRedirect() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (isRecoveryLink && pathname !== '/nova-password') navigate('/nova-password', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- de propósito, só no arranque
  }, [])
  return null
}

function App() {
  useEffect(preloadPages, [])
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <RecoveryRedirect />
        <Suspense fallback={<MascotSplash />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/recuperar-password" element={<ForgotPassword />} />
          <Route path="/nova-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/bem-vindo" element={<Onboarding />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/balanco" element={<Balance />} />
              <Route path="/patrimonio" element={<NetWorth />} />
              <Route path="/patrimonio/conta/:accountId" element={<AccountHistory />} />
              <Route path="/dividas" element={<Friends />} />
              <Route path="/dividas/:friendId" element={<FriendLedger />} />
              <Route path="/gestao" element={<Manage />} />
              <Route path="/perfil" element={<Profile />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
