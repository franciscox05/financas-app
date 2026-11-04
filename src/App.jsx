import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'
import { AuthProvider } from './context/AuthContext'
import AccountHistory from './pages/AccountHistory'
import Balance from './pages/Balance'
import Dashboard from './pages/Dashboard'
import FriendLedger from './pages/FriendLedger'
import Friends from './pages/Friends'
import Login from './pages/Login'
import Manage from './pages/Manage'
import NetWorth from './pages/NetWorth'
import Profile from './pages/Profile'
import ResetPassword from './pages/ResetPassword'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import { isRecoveryLink } from './lib/supabase'

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
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <RecoveryRedirect />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/recuperar-password" element={<ForgotPassword />} />
          <Route path="/nova-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
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
      </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
