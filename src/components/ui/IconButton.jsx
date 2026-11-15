// Botão só com ícone, sempre com 44×44 px de alvo de toque e sem borda.
// `label` é obrigatório (é o nome acessível). `as` permite usar um <Link>.
export default function IconButton({ as: Tag = 'button', label, tone = 'neutral', className = '', children, ...rest }) {
  const color = tone === 'accent' ? 'text-accent' : 'text-label-2'
  return (
    <Tag
      {...(Tag === 'button' ? { type: 'button' } : {})}
      aria-label={label}
      className={`pressable flex size-11 shrink-0 items-center justify-center rounded-full ${color} focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  )
}
