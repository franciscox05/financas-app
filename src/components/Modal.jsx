import { useEffect } from 'react'

// Base partilhada por todos os popups da app (confirmações, detalhe de
// transação, etc.) — um overlay + folha a subir de baixo no telemóvel
// (centrada em ecrãs maiores). Substitui o <dialog> nativo: num aparelho
// real (iPhone, PWA) estava a abrir "em linha" no conteúdo, sem escurecer
// o fundo nem flutuar por cima — showModal() não se comportava como modal.
export default function Modal({ open, onClose, labelledBy, children }) {
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="modal-overlay fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="modal-sheet max-h-[88vh] w-full overflow-y-auto rounded-t-[1.75rem] bg-surface p-5 text-label pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-xl sm:max-w-sm sm:rounded-[1.75rem] sm:pb-5"
      >
        <div
          aria-hidden="true"
          className="mx-auto -mt-2 mb-3 h-[5px] w-9 shrink-0 rounded-full bg-fill-strong sm:hidden"
        />
        {children}
      </div>
    </div>
  )
}
