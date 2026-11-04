import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkPassword } from '../lib/passwordRules'
import AuthBrand from './AuthBrand'

// Peças partilhadas pelos ecrãs de entrada, registo e recuperação de password, para todos terem o
// mesmo aspeto: título, alertas, botões, campos e a lista de regras da password.

export function AuthScreen({ title, subtitle, icon, stepKey, children, onSubmit }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-900">
      {/* `key` muda a cada passo: o conteúdo novo entra com .auth-step em vez de trocar de repente. */}
      <form key={stepKey} onSubmit={onSubmit} noValidate className="auth-step w-full max-w-sm space-y-5">
        {icon ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-green-600/10 text-green-600 ring-1 ring-green-600/20">
              {icon}
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">{title}</h1>
          </div>
        ) : (
          <AuthBrand title={title} />
        )}
        {subtitle && (
          <p className="-mt-2 text-center text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">{subtitle}</p>
        )}
        {children}
      </form>
    </div>
  )
}

// Alerta visível (não um texto vermelho solto): ícone, fundo suave e entrada com um ligeiro abanão
// nos erros para chamar a atenção. `role="alert"` faz o leitor de ecrã anunciá-lo.
export function AuthAlert({ kind = 'error', children }) {
  if (!children) return null
  const isError = kind === 'error'
  const Icon = isError ? AlertCircle : CheckCircle2
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm leading-snug ring-1 ${
        isError
          ? 'auth-alert-error bg-red-50 text-red-800 ring-red-200 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-900'
          : 'auth-alert bg-green-50 text-green-800 ring-green-200 dark:bg-green-950/60 dark:text-green-200 dark:ring-green-900'
      }`}
    >
      <Icon size={18} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

const buttonBase =
  'flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-medium transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:pointer-events-none disabled:opacity-50'

export function PrimaryButton({ loading, loadingText, children, ...props }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      {...props}
      className={`${buttonBase} bg-green-600 text-white hover:bg-green-700`}
    >
      {loading && <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
      {loading ? loadingText : children}
    </button>
  )
}

// Botão secundário com contorno: serve como <Link> (navegar) ou <button> (ação), conforme `to`.
export function SecondaryButton({ to, children, ...props }) {
  const className = `${buttonBase} bg-transparent text-neutral-700 ring-1 ring-neutral-300 hover:bg-neutral-100 dark:text-neutral-200 dark:ring-neutral-700 dark:hover:bg-neutral-800`
  if (to) {
    return (
      <Link to={to} className={className} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={className} {...props}>
      {children}
    </button>
  )
}

const inputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-base text-neutral-900 placeholder:text-neutral-400 focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

export function TextField({ label, ...props }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <input id={id} className={inputClass} {...props} />
    </div>
  )
}

// Campo de password com botão de mostrar/esconder (escrever às cegas no telemóvel dá erros).
export function PasswordField({ label, ...props }) {
  const id = useId()
  const [visible, setVisible] = useState(false)
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} className={`${inputClass} pr-11`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Esconder password' : 'Mostrar password'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-neutral-400 transition-colors hover:text-neutral-700 focus-visible:outline-2 focus-visible:outline-green-600 dark:hover:text-neutral-200"
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </div>
  )
}

// Lista de regras que se vão marcando enquanto se escreve: a pessoa vê o que falta antes de
// carregar no botão, em vez de levar com um erro depois.
export function PasswordChecklist({ password, confirm }) {
  const { rules } = checkPassword(password)
  const items = confirm === undefined ? rules : [...rules, { id: 'match', label: 'As duas passwords coincidem', ok: password.length > 0 && password === confirm }]
  return (
    <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2" aria-label="Regras da password">
      {items.map((r) => (
        <li
          key={r.id}
          className={`flex items-center gap-2 transition-colors duration-200 ${r.ok ? 'text-green-700 dark:text-green-400' : 'text-neutral-500'}`}
        >
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out ${
              r.ok ? 'scale-100 bg-green-600 text-white' : 'scale-90 bg-neutral-200 dark:bg-neutral-700'
            }`}
            aria-hidden="true"
          >
            {r.ok && <Check size={11} strokeWidth={3} />}
          </span>
          {r.label}
          <span className="sr-only">{r.ok ? '(cumprida)' : '(em falta)'}</span>
        </li>
      ))}
    </ul>
  )
}

// Código do email em caixas separadas. Por baixo é um único <input> invisível, por isso colar o
// código inteiro e o preenchimento automático do iOS ("Do Mail") funcionam como num campo normal.
export function OtpInput({ length, value, onChange, onComplete, disabled }) {
  const inputRef = useRef(null)
  const [focused, setFocused] = useState(false)

  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, length)
    onChange(digits)
    if (digits.length === length) onComplete?.(digits)
  }

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={length}
        disabled={disabled}
        autoFocus
        aria-label={`Código de ${length} dígitos`}
        className="absolute inset-0 h-full w-full cursor-text opacity-0"
      />
      <div className="flex justify-between gap-2" aria-hidden="true">
        {Array.from({ length }, (_, i) => {
          const char = value[i] ?? ''
          const active = focused && i === Math.min(value.length, length - 1)
          return (
            <span
              key={i}
              className={`flex h-14 flex-1 items-center justify-center rounded-xl border text-2xl font-semibold tabular-nums text-neutral-900 transition-[border-color,box-shadow] duration-150 dark:text-neutral-100 ${
                active
                  ? 'border-green-600 ring-2 ring-green-600/20'
                  : char
                    ? 'border-neutral-400 dark:border-neutral-500'
                    : 'border-neutral-300 dark:border-neutral-700'
              } bg-white dark:bg-neutral-800`}
            >
              {char || (active && <span className="otp-caret h-6 w-0.5 rounded-full bg-green-600" />)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
