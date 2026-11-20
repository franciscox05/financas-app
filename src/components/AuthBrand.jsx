import stingyIcon from '../assets/stingy-icone.svg'

export default function AuthBrand({ title }) {
  return (
    <div className="mb-2 flex flex-col items-center gap-3 text-center">
      <img
        src={stingyIcon}
        alt=""
        aria-hidden="true"
        className="size-16 rounded-[1.125rem] shadow-[var(--shadow-raised)]"
      />
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-label-3">Stingy</p>
        <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold tracking-tight text-label">{title}</h1>
      </div>
    </div>
  )
}
