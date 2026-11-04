import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthBrand from '../components/AuthBrand'
import { supabase } from '../lib/supabase'

// Pede o email de recuperação. A mensagem de sucesso é sempre a mesma, exista ou não conta com
// esse email — senão o formulário servia para descobrir quem usa a app.
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-password`,
    })
    setLoading(false)
    // Só o limite de envios merece ser mostrado; o resto ("user not found", etc.) fica escondido.
    if (resetError?.status === 429) {
      setError('Foram pedidos demasiados emails. Tenta outra vez daqui a uns minutos.')
      return
    }
    setSent(true)
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-900">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <AuthBrand title="Recuperar password" />

        {sent ? (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">
            Se existir uma conta com <strong>{email}</strong>, vais receber um email com um link para
            definir uma nova password. Vê também a pasta de spam.
          </p>
        ) : (
          <>
            <p className="text-sm text-neutral-500">
              Escreve o email da tua conta e enviamos-te um link para definires uma nova password.
            </p>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-green-600 py-2 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'A enviar...' : 'Enviar link'}
            </button>
          </>
        )}

        <p className="text-center text-sm text-neutral-500">
          <Link to="/login" className="text-green-600">
            Voltar a entrar
          </Link>
        </p>
      </form>
    </div>
  )
}
