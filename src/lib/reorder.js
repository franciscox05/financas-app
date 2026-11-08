// Lógica pura do arrastar-para-reordenar (DragReorderList.jsx) — separada do
// componente para poder ser testada sem DOM. `tops` é um snapshot, medido uma
// única vez no início do gesto, da posição/altura de cada linha na ordem
// original; o componente só volta a medir no próximo gesto, nunca a meio de
// um arrasto (senão o alvo "saltava" a cada pixel de movimento).

// Dado o deslocamento vertical do ponteiro desde o início do gesto, decide em
// que posição o item arrastado deve ficar — a posição cujo intervalo
// [top, top+height) contém o centro atual do item arrastado.
export function targetIndexForOffset(tops, draggedIndex, offset) {
  const draggedCenter = tops[draggedIndex].center + offset
  for (let i = 0; i < tops.length; i++) {
    if (i === draggedIndex) continue
    const slot = tops[i]
    if (draggedCenter >= slot.top && draggedCenter < slot.top + slot.height) {
      return i
    }
  }
  return draggedIndex
}

// Desloca uma lista: remove de `fromIndex` e insere em `toIndex`. Devolve o
// mesmo array (nova referência) se não houver mudança real.
export function moveItem(items, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return items
  const copy = [...items]
  const [moved] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, moved)
  return copy
}

// Quanto uma linha que NÃO está a ser arrastada deve deslocar-se (em px) para
// abrir espaço ao item arrastado — as que ficam "entre" a posição de origem e
// o alvo atual sobem/descem uma posição; as restantes não se movem.
export function shiftForIndex({ index, draggedIndex, targetIndex, draggedHeight }) {
  if (index === draggedIndex || targetIndex === draggedIndex) return 0
  if (targetIndex > draggedIndex) {
    return index > draggedIndex && index <= targetIndex ? -draggedHeight : 0
  }
  return index < draggedIndex && index >= targetIndex ? draggedHeight : 0
}
