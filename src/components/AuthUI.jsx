import { AlertCircle, Check, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkPassword } from '../lib/passwordRules'
import AuthBrand from './AuthBrand'

// Peças partilhadas pelos ecrãs de entrada, registo e recuperação de password, para todos terem o
// mesmo aspeto: título, alertas, botões, campos e a lista de regras da password.

export function AuthScreen({ title, subtitle, icon, stepKey, children, onSubmit }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-canvas px-5 py-10 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] text-label">
      {/* `key` muda a cada passo: o conteúdo novo entra com .auth-step em vez de trocar de repente. */}
      <form key={stepKey} onSubmit={onSubmit} noValidate className="auth-step w-full max-w-sm space-y-5">
        {icon ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent ring-1 ring-accent/20">
              {icon}
            </span>
            <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-label">{title}</h1>
          </div>
        ) : (
          <AuthBrand title={title} />
        )}
        {subtitle && (
          <p className="-mt-2 text-center text-[0.9375rem] leading-snug text-label-2">{subtitle}</p>
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
      className={`flex items-start gap-2.5 rounded-control px-3.5 py-3 text-sm leading-snug ring-1 ${
        isError
          ? 'auth-alert-error bg-negative/10 text-negative ring-negative'
          : 'auth-alert bg-positive/10 text-positive ring-accent'
      }`}
    >
      <Icon size={18} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

const buttonBase =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-control px-4 text-[1.0625rem] font-semibold transition-opacity duration-150 active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50'

export function PrimaryButton({ loading, loadingText, children, ...props }) {
  return (
    <button
      type="submit"
      disabled={loading || props.disabled}
      {...props}
      className={`${buttonBase} bg-accent-fill text-white`}
    >
      {loading && <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />}
      {loading ? loadingText : children}
    </button>
  )
}

// Botão secundário com contorno: serve como <Link> (navegar) ou <button> (ação), conforme `to`.
export function SecondaryButton({ to, children, ...props }) {
  const className = `${buttonBase} bg-fill text-label`
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
  'min-h-12 w-full rounded-control border-0 bg-surface px-4 text-label placeholder:text-label-3 focus:ring-2 focus:ring-accent'

export function TextField({ label, ...props }) {
  const id = useId()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-label">
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
      <label htmlFor={id} className="block text-sm font-medium text-label">
        {label}
      </label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} className={`${inputClass} pr-11`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Esconder password' : 'Mostrar password'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-label-3 transition-colors hover:text-label focus-visible:outline-2 focus-visible:outline-accent"
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
          className={`flex items-center gap-2 transition-colors duration-200 ${r.ok ? 'text-positive' : 'text-label-2'}`}
        >
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded-full transition-[background-color,transform] duration-200 ease-out ${
              r.ok ? 'scale-100 bg-positive text-white' : 'scale-90 bg-fill-strong'
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
              className={`flex h-14 flex-1 items-center justify-center rounded-control border text-2xl font-semibold tabular-nums text-label transition-[border-color,box-shadow] duration-150 ${
                active
                  ? 'border-accent ring-2 ring-accent/20'
                  : char
                    ? 'border-separator'
                    : 'border-separator'
              } bg-surface`}
            >
              {char || (active && <span className="otp-caret h-6 w-0.5 rounded-full bg-accent-fill" />)}
            </span>
          )
        })}
      </div>
    </div>
  )
}
