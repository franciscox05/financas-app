// Importador universal de extratos bancários: cada banco exporta o CSV com um
// layout diferente (nomes de coluna, separador, formato de data, vírgula ou
// ponto decimal, uma coluna de valor com sinal ou colunas Débito/Crédito
// separadas). Em vez de pedir ao utilizador para saber isto, tentamos
// adivinhar pelo cabeçalho e só pedimos confirmação manual se a deteção falhar.
import Papa from 'papaparse'
import { normalize } from './categorySuggest'

const HEADER_HINTS = {
  date: ['data mov', 'data valor', 'data lanc', 'datamov', 'data', 'date'],
  amount: ['valor', 'montante', 'amount', 'quantia', 'importancia'],
  debit: ['debito', 'debit', 'saida', 'a debito'],
  credit: ['credito', 'credit', 'entrada', 'a credito'],
  description: ['descricao', 'descritivo', 'description', 'memo', 'historico', 'detalhe', 'detalhes', 'movimento', 'nota', 'beneficiario', 'operacao'],
}

const DATE_PATTERNS = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})$/, order: ['y', 'm', 'd'] },
  { regex: /^(\d{4})\/(\d{2})\/(\d{2})$/, order: ['y', 'm', 'd'] },
  { regex: /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/, order: ['d', 'm', 'y'] },
  { regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, order: ['d', 'm', 'y'] },
  { regex: /^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/, order: ['d', 'm', 'y2'] },
]

/** Lê o ficheiro CSV no cliente. Deteta automaticamente o separador (",", ";", tab). */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimitersToGuess: [',', ';', '\t', '|'],
      complete: (result) => {
        const headers = result.meta.fields ?? []
        if (headers.length === 0 || result.data.length === 0) {
          reject(new Error('Não consegui ler nenhuma linha deste ficheiro. Confirma que é um CSV exportado pelo banco.'))
          return
        }
        resolve({ headers, data: result.data })
      },
      error: (err) => reject(err),
    })
  })
}

function bestHeaderFor(headers, hints, taken) {
  let best = null
  let bestScore = 0
  for (const header of headers) {
    if (taken.has(header)) continue
    const norm = normalize(header)
    for (const hint of hints) {
      if (norm === hint) {
        return header // match exato, não há melhor
      }
      if (norm.includes(hint) && hint.length > bestScore) {
        bestScore = hint.length
        best = header
      }
    }
  }
  return bestScore > 0 ? best : null
}

function parseAmountText(text) {
  const cleaned = String(text ?? '')
    .replace(/[€$]/g, '')
    .trim()
  if (!cleaned) return null

  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith('-')
  let digits = cleaned.replace(/^[(-]/, '').replace(/\)$/, '').trim()

  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  if (lastComma > lastDot) {
    // vírgula é o separador decimal (formato PT/EU): remove pontos de milhar
    digits = digits.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // ponto é o separador decimal (formato EN): remove vírgulas de milhar
    digits = digits.replace(/,/g, '')
  }

  const value = Number(digits)
  if (Number.isNaN(value)) return null
  return negative ? -Math.abs(value) : value
}

function parseDateText(text) {
  const trimmed = String(text ?? '').trim()
  for (const { regex, order } of DATE_PATTERNS) {
    const match = trimmed.match(regex)
    if (!match) continue
    const parts = {}
    order.forEach((key, i) => {
      parts[key] = match[i + 1]
    })
    const year = parts.y ? Number(parts.y) : 2000 + Number(parts.y2)
    const month = String(parts.m).padStart(2, '0')
    const day = String(parts.d).padStart(2, '0')
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) continue
    return `${year}-${month}-${day}`
  }
  return null
}

/**
 * Tenta mapear automaticamente as colunas do CSV para os campos que a app
 * precisa. `confident` indica se a deteção teve sucesso nos campos essenciais
 * (data + uma fonte de valor) — quando falso, a interface deve pedir ao
 * utilizador para escolher as colunas manualmente antes de avançar.
 */
export function detectColumns(headers, sampleRows) {
  const taken = new Set()
  const date = bestHeaderFor(headers, HEADER_HINTS.date, taken)
  if (date) taken.add(date)
  const description = bestHeaderFor(headers, HEADER_HINTS.description, taken)
  if (description) taken.add(description)

  let amount = bestHeaderFor(headers, HEADER_HINTS.amount, taken)
  let debit = null
  let credit = null
  if (amount) {
    taken.add(amount)
  } else {
    debit = bestHeaderFor(headers, HEADER_HINTS.debit, taken)
    if (debit) taken.add(debit)
    credit = bestHeaderFor(headers, HEADER_HINTS.credit, taken)
    if (credit) taken.add(credit)
  }

  let detectedDate = date
  if (!detectedDate) {
    detectedDate = headers.find((h) => {
      if (taken.has(h)) return false
      const hits = sampleRows.filter((row) => parseDateText(row[h])).length
      return hits >= Math.max(1, Math.ceil(sampleRows.length * 0.6))
    }) ?? null
  }

  const confident = Boolean(detectedDate) && Boolean(amount || (debit && credit))

  return {
    columns: { date: detectedDate, amount, debit, credit, description },
    headers,
    confident,
  }
}

/**
 * Converte as linhas em bruto do CSV para o formato que o resto da app usa
 * (occurredOn ISO, type income/expense, amount sempre positivo, note). Linhas
 * que não têm data ou valor válidos ficam marcadas com `invalid: true` em vez
 * de serem descartadas em silêncio — o utilizador decide se as ignora.
 */
export function buildCsvRows(data, columns) {
  return data.map((raw, index) => {
    const occurredOn = columns.date ? parseDateText(raw[columns.date]) : null

    let signedAmount = null
    if (columns.amount) {
      signedAmount = parseAmountText(raw[columns.amount])
    } else if (columns.debit || columns.credit) {
      const debitValue = columns.debit ? parseAmountText(raw[columns.debit]) : null
      const creditValue = columns.credit ? parseAmountText(raw[columns.credit]) : null
      if (creditValue) signedAmount = Math.abs(creditValue)
      else if (debitValue) signedAmount = -Math.abs(debitValue)
    }

    const note = columns.description ? String(raw[columns.description] ?? '').trim() : ''
    const invalid = !occurredOn || signedAmount === null || signedAmount === 0

    return {
      index,
      invalid,
      occurredOn,
      type: signedAmount != null && signedAmount >= 0 ? 'income' : 'expense',
      amount: signedAmount != null ? Math.abs(signedAmount) : 0,
      note,
      originalDate: columns.date ? raw[columns.date] : '',
      originalAmount: columns.amount
        ? raw[columns.amount]
        : [raw[columns.debit], raw[columns.credit]].filter(Boolean).join(' / '),
    }
  })
}
