import MascotTile from './MascotTile'

export default function AuthBrand({ title }) {
  return (
    <div className="mb-2 flex flex-col items-center gap-3 text-center">
      <MascotTile size={112} motion="enter" className="shadow-[var(--shadow-raised)]" />
      <div>
        <p className="text-[1.0625rem] font-bold tracking-tight text-accent">Stingy</p>
        <h1 className="mt-0.5 text-[1.75rem] leading-tight font-bold tracking-tight text-label">{title}</h1>
      </div>
    </div>
  )
}
