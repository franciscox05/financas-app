import test from 'node:test'
import assert from 'node:assert/strict'
import { moveItem, shiftForIndex, targetIndexForOffset } from './reorder.js'

// 3 linhas de 40px cada, medidas no início do gesto: [0,40) [40,80) [80,120)
const tops = [
  { top: 0, height: 40, center: 20 },
  { top: 40, height: 40, center: 60 },
  { top: 80, height: 40, center: 100 },
]

test('sem deslocamento, o alvo é a própria posição original', () => {
  assert.equal(targetIndexForOffset(tops, 0, 0), 0)
})

test('arrastar a linha 0 para baixo até ao centro da linha 2', () => {
  // centro de 0 é 20; para cair no intervalo [80,120) precisa de offset >= 60
  assert.equal(targetIndexForOffset(tops, 0, 65), 2)
})

test('arrastar a linha 2 para cima até à linha 0', () => {
  // centro de 2 é 100; para cair em [0,40) precisa de offset <= -65
  assert.equal(targetIndexForOffset(tops, 2, -70), 0)
})

test('um pequeno deslocamento que não cruza a fronteira da vizinha mantém a posição', () => {
  // centro de 0 é 20; mover 15px dá 35, ainda dentro de [0,40)
  assert.equal(targetIndexForOffset(tops, 0, 15), 0)
})

test('moveItem desloca o item e devolve um array novo', () => {
  const items = ['a', 'b', 'c']
  assert.deepEqual(moveItem(items, 0, 2), ['b', 'c', 'a'])
  assert.deepEqual(moveItem(items, 2, 0), ['c', 'a', 'b'])
})

test('moveItem sem mudança real devolve a mesma referência (sem re-render)', () => {
  const items = ['a', 'b', 'c']
  assert.equal(moveItem(items, 1, 1), items)
})

test('shiftForIndex: arrastar para baixo empurra as linhas entre a origem e o alvo para cima', () => {
  const draggedHeight = 40
  // arrastar índice 0 para o alvo 2: índices 1 e 2 sobem (valor negativo)
  assert.equal(shiftForIndex({ index: 1, draggedIndex: 0, targetIndex: 2, draggedHeight }), -40)
  assert.equal(shiftForIndex({ index: 2, draggedIndex: 0, targetIndex: 2, draggedHeight }), -40)
  // o próprio item arrastado e linhas fora do intervalo não deslocam
  assert.equal(shiftForIndex({ index: 0, draggedIndex: 0, targetIndex: 2, draggedHeight }), 0)
})

test('shiftForIndex: arrastar para cima empurra as linhas entre o alvo e a origem para baixo', () => {
  const draggedHeight = 40
  assert.equal(shiftForIndex({ index: 0, draggedIndex: 2, targetIndex: 0, draggedHeight }), 40)
  assert.equal(shiftForIndex({ index: 1, draggedIndex: 2, targetIndex: 0, draggedHeight }), 40)
  assert.equal(shiftForIndex({ index: 2, draggedIndex: 2, targetIndex: 0, draggedHeight }), 0)
})

test('shiftForIndex: sem alvo diferente da origem, nada se desloca', () => {
  assert.equal(shiftForIndex({ index: 1, draggedIndex: 0, targetIndex: 0, draggedHeight: 40 }), 0)
})
