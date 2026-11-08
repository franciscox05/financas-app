import { useRef, useState } from 'react'
import { moveItem, shiftForIndex, targetIndexForOffset } from '../lib/reorder'

// Lista reordenável por toque e arraste, mobile-first. Cada linha expõe uma
// "asa" (ícone) que o `renderItem` liga a `dragHandleProps` — arrastar
// começa só a partir dela, para o resto da linha continuar a abrir outras
// ações (editar, apagar, atualizar saldo) sem conflito com o gesto.
//
// Enquanto se arrasta, a posição não é recalculada no array a cada pixel —
// isso faria o DOM reordenar a meio do gesto e perder a referência visual.
// Em vez disso: o item arrastado segue o dedo com `transform` (sem saltar de
// posição no array) e as linhas que ficariam "no caminho" deslizam para abrir
// espaço, também só com `transform` (ver reorder.js). Só ao soltar é que a
// nova ordem é calculada e entregue a `onReorder` — um único pedido ao
// servidor por gesto, não um por pixel.
//
// `session` (estado, não ref) guarda o que a sessão de arrasto precisa para
// renderizar — `draggedIndex`/`tops`/`targetIndex`, medidos uma vez no início
// do gesto. `pointerIdRef`/`itemRefs`/`listRef` só são tocados dentro dos
// handlers (nunca no cálculo de `shift`/`style` abaixo).
export default function DragReorderList({
  items,
  onReorder,
  keyExtractor = (item) => item.id,
  renderItem,
  className = '',
}) {
  const [session, setSession] = useState(null) // { key, draggedIndex, tops, offset, targetIndex }
  const pointerIdRef = useRef(null)
  const itemRefs = useRef(new Map())
  const listRef = useRef(null)

  function setItemRef(key, el) {
    if (el) itemRefs.current.set(key, el)
    else itemRefs.current.delete(key)
  }

  function handlePointerDown(e, key) {
    const draggedIndex = items.findIndex((item) => keyExtractor(item) === key)
    const listEl = listRef.current
    if (draggedIndex < 0 || !listEl) return

    const listTop = listEl.getBoundingClientRect().top
    const tops = items.map((item) => {
      const el = itemRefs.current.get(keyExtractor(item))
      const rect = el.getBoundingClientRect()
      const top = rect.top - listTop
      return { top, height: rect.height, center: top + rect.height / 2 }
    })

    pointerIdRef.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    setSession({ key, draggedIndex, tops, startClientY: e.clientY, offset: 0, targetIndex: draggedIndex })
  }

  function handlePointerMove(e) {
    if (pointerIdRef.current !== e.pointerId) return
    setSession((prev) => {
      if (!prev) return prev
      const offset = e.clientY - prev.startClientY
      const targetIndex = targetIndexForOffset(prev.tops, prev.draggedIndex, offset)
      return { ...prev, offset, targetIndex }
    })
  }

  function endDrag(e) {
    if (pointerIdRef.current !== e.pointerId) return
    pointerIdRef.current = null
    setSession((prev) => {
      if (prev && prev.targetIndex !== prev.draggedIndex) {
        onReorder(moveItem(items, prev.draggedIndex, prev.targetIndex))
      }
      return null
    })
  }

  return (
    <ul ref={listRef} className={className}>
      {/* eslint-disable-next-line react/refs -- dragHandleProps (abaixo) só liga handlePointerDown/Move/endDrag
          como listeners nativos (onPointer*) na "asa" de arrastar; nenhum corre agora, só mais tarde a um
          gesto real. O linter não vê isso através da chamada a `renderItem` (função do consumidor deste
          componente) e assume o pior — mas os refs que esses handlers tocam só são lidos/escritos dentro
          deles, nunca no cálculo de `shift`/`style` abaixo, que é o que de facto corre durante o render. */}
      {items.map((item, index) => {
        const key = keyExtractor(item)
        const isDragging = session?.key === key
        const shift =
          session && !isDragging
            ? shiftForIndex({
                index,
                draggedIndex: session.draggedIndex,
                targetIndex: session.targetIndex,
                draggedHeight: session.tops[session.draggedIndex].height,
              })
            : 0

        const style = isDragging
          ? { transform: `translateY(${session.offset}px)`, position: 'relative', zIndex: 10 }
          : { transform: shift ? `translateY(${shift}px)` : undefined, transition: 'transform 150ms ease-out' }

        return (
          <li
            key={key}
            ref={(el) => setItemRef(key, el)}
            style={style}
            className={isDragging ? 'shadow-lg' : ''}
          >
            {renderItem(item, {
              isDragging,
              dragHandleProps: {
                onPointerDown: (e) => handlePointerDown(e, key),
                onPointerMove: handlePointerMove,
                onPointerUp: endDrag,
                onPointerCancel: endDrag,
                style: { touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' },
              },
            })}
          </li>
        )
      })}
    </ul>
  )
}
