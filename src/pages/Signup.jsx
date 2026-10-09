import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AuthBrand from '../components/AuthBrand'
import { useAuth } from '../context/AuthContext'

export default function Signup() {
  const { signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | sent | loggedIn | error
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setError('')
    const { data, error: signUpError } = await signUp(email, password, fullName)
    if (signUpError) {
      setError(signUpError.message)
      setStatus('error')
      return
    }
    // Com "Confirm email" desativado no Supabase, o signup já devolve sessão ativa.
    setStatus(data.session ? 'loggedIn' : 'sent')
  }

  if (status === 'loggedIn') return <Navigate to="/" replace />

  if (status === 'sent') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-900">
        <p className="max-w-sm text-center text-neutral-600 dark:text-neutral-300">
          Conta criada. Verifica o email <strong>{email}</strong> para confirmar antes de entrares.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <AuthBrand title="Criar conta" />

        <input
          type="text"
          required
          placeholder="Nome"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
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
          minLength={8}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-lg bg-green-600 py-2 font-medium text-white disabled:opacity-50"
        >
          {status === 'loading' ? 'A criar...' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-neutral-500">
          Já tens conta? <Link to="/login" className="text-green-600">Entrar</Link>
        </p>
      </form>
    </div>
  )
}
