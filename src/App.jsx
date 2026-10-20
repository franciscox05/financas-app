import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import ToastProvider from './components/ToastProvider'
import { AuthProvider } from './context/AuthContext'
import AccountHistory from './pages/AccountHistory'
import Balance from './pages/Balance'
import Dashboard from './pages/Dashboard'
import Friends from './pages/Friends'
import Login from './pages/Login'
import Manage from './pages/Manage'
import NetWorth from './pages/NetWorth'
import Signup from './pages/Signup'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/balanco" element={<Balance />} />
              <Route path="/patrimonio" element={<NetWorth />} />
              <Route path="/patrimonio/conta/:accountId" element={<AccountHistory />} />
              <Route path="/dividas" element={<Friends />} />
              <Route path="/gestao" element={<Manage />} />
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
