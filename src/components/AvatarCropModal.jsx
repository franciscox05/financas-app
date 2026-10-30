import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 dark:focus-visible:outline-neutral-100'

const FRAME = 280 // tamanho do visor quadrado, em px CSS
const OUTPUT = 480 // lado do quadrado final gravado

// Mantém o retângulo visível dentro dos limites da imagem (nunca mostra
// fundo vazio à volta).
function clampOffset(value, naturalSize, scale) {
  const displayed = naturalSize * scale
  const min = FRAME - displayed // negativo: o quanto a imagem "sobra" para a esquerda/cima
  return Math.min(0, Math.max(min, value))
}

// Passo intermédio de pan/zoom antes de enviar a foto de perfil — recorta
// sempre um quadrado, com um <canvas> simples (sem biblioteca nova). `file`
// é o ficheiro escolhido no input; `onCropped(blob)` devolve o resultado já
// recortado, `onCancel` fecha sem enviar nada.
export default function AvatarCropModal({ file, onCropped, onCancel }) {
  const [imgEl, setImgEl] = useState(null)
  const [baseScale, setBaseScale] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)
  const dragRef = useRef(null)
  const frameRef = useRef(null)

  const open = file !== null

  // Carrega a imagem escolhida e centra-a a cobrir o quadrado (como object-fit: cover).
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const cover = Math.max(FRAME / img.naturalWidth, FRAME / img.naturalHeight)
      setBaseScale(cover)
      setZoom(1)
      setPos({
        x: (FRAME - img.naturalWidth * cover) / 2,
        y: (FRAME - img.naturalHeight * cover) / 2,
      })
      setImgEl(img)
    }
    img.src = url
    return () => {
      URL.revokeObjectURL(url)
      setImgEl(null)
    }
  }, [file])

  const scale = baseScale * zoom

  function handleZoomChange(nextZoom) {
    if (!imgEl) return
    const nextScale = baseScale * nextZoom
    // Mantém o ponto que estava no centro do visor, centrado também depois do zoom.
    const centerSrcX = (FRAME / 2 - pos.x) / scale
    const centerSrcY = (FRAME / 2 - pos.y) / scale
    setZoom(nextZoom)
    setPos({
      x: clampOffset(FRAME / 2 - centerSrcX * nextScale, imgEl.naturalWidth, nextScale),
      y: clampOffset(FRAME / 2 - centerSrcY * nextScale, imgEl.naturalHeight, nextScale),
    })
  }

  function handlePointerDown(e) {
    if (!imgEl) return
    frameRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, origin: pos }
  }

  function handlePointerMove(e) {
    if (!dragRef.current || !imgEl) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({
      x: clampOffset(dragRef.current.origin.x + dx, imgEl.naturalWidth, scale),
      y: clampOffset(dragRef.current.origin.y + dy, imgEl.naturalHeight, scale),
    })
  }

  function handlePointerUp(e) {
    frameRef.current?.releasePointerCapture(e.pointerId)
    dragRef.current = null
  }

  function handleConfirm() {
    if (!imgEl || saving) return
    setSaving(true)
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')
    const sx = (0 - pos.x) / scale
    const sy = (0 - pos.y) / scale
    const sSize = FRAME / scale
    ctx.drawImage(imgEl, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT)
    canvas.toBlob(
      (blob) => {
        setSaving(false)
        if (blob) onCropped(blob)
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <Modal open={open} onClose={onCancel} labelledBy="avatar-crop-title">
      {open && (
        <div className="space-y-4">
          <h2 id="avatar-crop-title" className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Ajustar foto
          </h2>

          <div
            ref={frameRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{ width: FRAME, height: FRAME, touchAction: 'none' }}
            className="relative mx-auto overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800"
          >
            {imgEl && (
              <img
                src={imgEl.src}
                alt=""
                draggable={false}
                className="absolute left-0 top-0 max-w-none select-none"
                style={{
                  width: imgEl.naturalWidth * scale,
                  height: imgEl.naturalHeight * scale,
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                }}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              className="flex-1 accent-neutral-900 dark:accent-neutral-100"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className={`min-h-11 flex-1 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 ${focusRing}`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!imgEl || saving}
              className={`min-h-11 flex-1 rounded-lg bg-neutral-900 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 ${focusRing}`}
            >
              {saving ? 'A preparar...' : 'Usar esta foto'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
