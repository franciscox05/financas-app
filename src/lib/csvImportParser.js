// Importador universal de extratos bancários: cada banco exporta o CSV com um
// layout diferente (nomes de coluna, separador, formato de data, vírgula ou
// ponto decimal, uma coluna de valor com sinal ou colunas Débito/Crédito
// separadas). Em vez de pedir ao utilizador para saber isto, tentamos
// adivinhar pelo cabeçalho e só pedimos confirmação manual se a deteção falhar.
import Papa from 'papaparse'
import { normalize } from './categorySuggest.js'

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

// S2-6 (auditoria de 15/11): aceita espaços (normais ou não separáveis) como
// separador de milhar e sinal no fim ("123,45-"). Quando só há UM tipo de
// separador e todos os grupos depois dele têm exatamente 3 dígitos ("1.500",
// "1,500", "1.234.567"), é milhar — antes "1.500" (formato PT sem cêntimos) era
// lido como 1,50 €. Exceção: com parte inteira "0" ("0.500") é decimal.
export function parseAmountText(text) {
  const cleaned = String(text ?? '')
    .replace(/[€$£]/g, '')
    .replace(/[\s  ]/g, '')
  if (!cleaned) return null

  const negative = /^\(.*\)$/.test(cleaned) || cleaned.startsWith('-') || cleaned.endsWith('-')
  let digits = cleaned.replace(/^[(-]/, '').replace(/[)-]$/, '')

  const lastComma = digits.lastIndexOf(',')
  const lastDot = digits.lastIndexOf('.')
  const singleSep = lastComma === -1 && lastDot !== -1 ? '.' : lastDot === -1 && lastComma !== -1 ? ',' : null
  if (singleSep) {
    const parts = digits.split(singleSep)
    const thousands =
      parts[0] !== '0' && parts[0].length <= 3 && parts.slice(1).every((p) => p.length === 3)
    // Vários separadores iguais ("1.234.567") só podem ser milhares.
    digits = thousands || parts.length > 2 ? parts.join('') : parts.join('.')
  } else if (lastComma > lastDot) {
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
    const month = Number(parts.m)
    const day = Number(parts.d)
    // Dia válido NESTE mês, não só 1-31: um "31/02/2026" passava o teste
    // antigo e saía como "2026-02-31", data que não existe. A linha não ficava
    // marcada como inválida (tinha data), entrava na gravação, e como
    // `createTransactionsBulk` insere tudo num só INSERT, o Postgres rejeitava
    // o lote INTEIRO por causa de uma linha — o importador falhava todo com um
    // erro de base de dados em vez de sinalizar a linha.
    if (month < 1 || month > 12 || day < 1) continue
    if (day > new Date(Date.UTC(year, month, 0)).getUTCDate()) continue
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
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
