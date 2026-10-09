import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import AuthBrand from '../components/AuthBrand'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn, user } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: signInError } = await signIn(email, password)
    if (signInError) setError(signInError.message)
    setLoading(false)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <AuthBrand title="Entrar" />

        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-green-600 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'A entrar...' : 'Entrar'}
        </button>

        <p className="text-center text-sm text-neutral-500">
          Ainda não tens conta? <Link to="/signup" className="text-green-600">Criar conta</Link>
        </p>
      </form>
    </div>
  )
}
