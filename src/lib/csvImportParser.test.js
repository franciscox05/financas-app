import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCsvRows, detectColumns } from './csvImportParser.js'

const cols = { date: 'Data', amount: 'Valor', debit: null, credit: null, description: 'Descricao' }

test('data que não existe no calendário fica inválida em vez de ir para a gravação', () => {
  // 31/02 passava como "2026-02-31" e fazia o Postgres rejeitar o lote inteiro.
  const [row] = buildCsvRows([{ Data: '31/02/2026', Valor: '-10,00', Descricao: 'x' }], cols)
  assert.equal(row.invalid, true)
  assert.equal(row.occurredOn, null)
})

test('29 de fevereiro conta em ano bissexto e não conta fora dele', () => {
  const [bissexto] = buildCsvRows([{ Data: '29/02/2024', Valor: '-10,00', Descricao: 'x' }], cols)
  assert.equal(bissexto.occurredOn, '2024-02-29')
  const [comum] = buildCsvRows([{ Data: '29/02/2026', Valor: '-10,00', Descricao: 'x' }], cols)
  assert.equal(comum.invalid, true)
})

test('formatos de valor PT e EN, parênteses e milhares', () => {
  const rows = buildCsvRows(
    [
      { Data: '2026-01-05', Valor: '1.234,56', Descricao: 'pt' },
      { Data: '2026-01-05', Valor: '1,234.56', Descricao: 'en' },
      { Data: '2026-01-05', Valor: '(40,00)', Descricao: 'parenteses' },
      { Data: '2026-01-05', Valor: '-4.490,00', Descricao: 'negativo pt' },
    ],
    cols,
  )
  assert.deepEqual(
    rows.map((r) => [r.type, r.amount]),
    [
      ['income', 1234.56],
      ['income', 1234.56],
      ['expense', 40],
      ['expense', 4490],
    ],
  )
})

test('linha sem valor ou com valor zero fica inválida', () => {
  const rows = buildCsvRows(
    [
      { Data: '2026-01-05', Valor: '', Descricao: 'vazio' },
      { Data: '2026-01-05', Valor: '0,00', Descricao: 'zero' },
    ],
    cols,
  )
  assert.deepEqual(rows.map((r) => r.invalid), [true, true])
})

test('colunas Débito/Crédito separadas em vez de uma coluna com sinal', () => {
  const headers = ['Data Mov', 'Descritivo', 'Débito', 'Crédito']
  const { columns, confident } = detectColumns(headers, [{ 'Data Mov': '05-01-2026' }])
  assert.equal(confident, true)
  assert.equal(columns.debit, 'Débito')
  assert.equal(columns.credit, 'Crédito')
  const rows = buildCsvRows(
    [
      { 'Data Mov': '05-01-2026', Descritivo: 'saiu', 'Débito': '30,00', 'Crédito': '' },
      { 'Data Mov': '06-01-2026', Descritivo: 'entrou', 'Débito': '', 'Crédito': '12,50' },
    ],
    columns,
  )
  assert.deepEqual(
    rows.map((r) => [r.occurredOn, r.type, r.amount]),
    [
      ['2026-01-05', 'expense', 30],
      ['2026-01-06', 'income', 12.5],
    ],
  )
})
