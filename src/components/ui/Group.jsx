import { ChevronRight } from 'lucide-react'

// Grupo de lista ao estilo das Definições do iOS: título pequeno por fora, uma
// superfície arredondada sem borda, e uma nota opcional por baixo.
//
// - `header` / `aside`: título do grupo e um valor ou ação à direita.
// - `footer`: explicação curta por baixo do grupo.
// - `list`: quando true, os filhos são <Row> e levam separadores recuados
//   (`inset` = onde começa o separador; 3.75rem quando as linhas têm avatar).
// - sem `list`, é só a superfície com padding (para gráficos, texto, etc.).
export default function Group({
  header,
  aside,
  footer,
  list = false,
  inset = '1rem',
  as: Tag = 'section',
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag className={className} {...rest}>
      {(header || aside) && (
        <div className="mb-2 flex min-h-6 items-baseline justify-between gap-3 px-4">
          {header && <h2 className="text-[0.8125rem] font-semibold tracking-wide text-label-2 uppercase">{header}</h2>}
          {aside && <div className="amount text-[0.9375rem] font-semibold text-label">{aside}</div>}
        </div>
      )}
      {list ? (
        <ul className="grouped overflow-hidden rounded-group bg-surface" style={{ '--row-inset': inset }}>
          {children}
        </ul>
      ) : (
        <div className="rounded-group bg-surface p-4">{children}</div>
      )}
      {footer && <p className="mt-2 px-4 text-[0.8125rem] leading-snug text-label-2">{footer}</p>}
    </Tag>
  )
}

// Linha de um grupo: no mínimo 44 px de altura (alvo de toque), título e
// subtítulo à esquerda, valor à direita e seta quando leva a outro sítio.
//
// `as` pode ser 'button', um <Link> do router ou 'div' (linha só de leitura);
// as props extra (onClick, to, ...) passam para esse elemento.
export function Row({
  as: Tag = 'div',
  leading,
  title,
  subtitle,
  value,
  valueNote,
  valueClassName = 'text-label',
  chevron = false,
  className = '',
  children,
  ...rest
}) {
  const interactive = Tag !== 'div'
  return (
    <li>
      <Tag
        {...(Tag === 'button' ? { type: 'button' } : {})}
        className={`flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left ${
          interactive
            ? 'pressable focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent'
            : ''
        } ${className}`}
        {...rest}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] leading-snug text-label">{title}</span>
          {subtitle && <span className="block truncate text-[0.8125rem] leading-snug text-label-2">{subtitle}</span>}
        </span>
        {(value != null || valueNote) && (
          <span className="shrink-0 text-right">
            {value != null && (
              <span className={`amount block text-[1.0625rem] leading-snug ${valueClassName}`}>{value}</span>
            )}
            {valueNote && <span className={`block text-[0.8125rem] leading-snug ${valueClassName}`}>{valueNote}</span>}
          </span>
        )}
        {children}
        {chevron && <ChevronRight size={18} strokeWidth={2.25} aria-hidden="true" className="-mr-1 shrink-0 text-label-3" />}
      </Tag>
    </li>
  )
}
