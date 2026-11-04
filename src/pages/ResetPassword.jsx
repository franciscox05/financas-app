import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthBrand from '../components/AuthBrand'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const MIN_LENGTH = 8 // igual ao registo (Signup.jsx)

// Destino do link do email de recuperação. O supabase-js lê o token do URL e abre uma sessão
// temporária; com ela, `updateUser` troca a password. Sem sessão o link expirou ou já foi usado.
export default function ResetPassword() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('As passwords não coincidem.')
      return
    }
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError(
        updateError.code === 'same_password'
          ? 'A nova password tem de ser diferente da anterior.'
          : updateError.code === 'weak_password'
            ? `A password tem de ter pelo menos ${MIN_LENGTH} caracteres, com minúsculas, maiúsculas e números.`
            : updateError.message,
      )
      return
    }
    navigate('/', { replace: true })
  }

  const inputClass =
    'w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <AuthBrand title="Nova password" />

        {authLoading ? (
          <p className="text-center text-sm text-neutral-500">A validar o link...</p>
        ) : !user ? (
          <>
            <p className="text-sm text-neutral-500">
              Este link expirou ou já foi usado. Pede um novo para definires a password.
            </p>
            <Link
              to="/recuperar-password"
              className="block w-full rounded-lg bg-green-600 py-2 text-center font-medium text-white"
            >
              Pedir novo link
            </Link>
          </>
        ) : (
          <>
            {/* Regras definidas no Supabase (Auth → Email): mín. 8, minúsculas, maiúsculas e dígitos. */}
            <p className="text-sm text-neutral-500">
              Pelo menos {MIN_LENGTH} caracteres, com minúsculas, maiúsculas e números.
            </p>
            <input
              type="password"
              required
              minLength={MIN_LENGTH}
              autoComplete="new-password"
              placeholder="Nova password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              required
              minLength={MIN_LENGTH}
              autoComplete="new-password"
              placeholder="Repetir nova password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 py-2 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'A guardar...' : 'Guardar password'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
