// Contentor padrão de toda a app. Antes havia dois estilos a competir — uns
// blocos só com borda (`rounded-xl border`) e outros com borda e fundo
// (`bg-white dark:bg-neutral-900`) — e várias secções sem contentor nenhum,
// com o título e a lista soltos sobre o fundo da página. Daí vinha a sensação
// de margens e paddings desencontrados: não eram as margens, era a falta de um
// único conceito de "caixa".
//
// No tema escuro o fundo é que resolve a leitura: a página é neutral-950 e o
// cartão neutral-900, por isso cada bloco levanta-se do fundo em vez de
// depender só de uma borda de 1px. Os campos de escrita dentro do cartão são
// neutral-800, mais claros que ele, mantendo a hierarquia página < cartão <
// campo.
export const CARD_CLASS =
  'rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900'

const CARD = 'rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'

const PADDING = { none: '', sm: 'p-3', md: 'p-4' }

export default function Card({ as: Tag = 'div', padding = 'md', className = '', children, ...rest }) {
  return (
    <Tag className={`${CARD} ${PADDING[padding]} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  )
}

// Cartão com cabeçalho: título à esquerda, valor/ação opcional à direita e uma
// linha de explicação opcional por baixo. Mantém a mesma hierarquia tipográfica
// em todas as páginas — título `text-sm font-semibold` em neutral-500, apoio
// em `text-xs` neutral-400 — em vez de cada secção escolher a sua.
export function SectionCard({ title, hint, aside, padding = 'md', className = '', children, ...rest }) {
  return (
    <Card padding={padding} className={className} as="section" {...rest}>
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-2">
          {title && <h3 className="text-sm font-semibold text-neutral-500">{title}</h3>}
          {aside}
        </div>
      )}
      {hint && <p className="mt-1 text-xs leading-relaxed text-neutral-400">{hint}</p>}
      {children && <div className={title || hint ? 'mt-3' : ''}>{children}</div>}
    </Card>
  )
}
