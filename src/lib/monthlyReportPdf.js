// Relatório mensal em PDF, com aspeto de extrato bancário/relatório executivo.
// Gerado inteiramente no cliente (jsPDF + jspdf-autotable) — sem pedidos novos
// à base de dados, a partir dos mesmos dados já calculados para o ecrã
// (ver monthlyReport.js), para nunca discordar do que o utilizador vê.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { eur } from './format.js'
import {
  averageDailyExpense,
  expenseByAccount,
  netSavings,
  peakExpenseDay,
  savingsRate,
  topExpenses,
} from './monthlyReport.js'

const PAGE_WIDTH = 210 // A4, mm
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const SECTION_GAP = 9 // espaço vertical entre secções, consistente em todo o documento

// Paleta alinhada com o resto da app (Balance.jsx / NetWorth.jsx).
const INK = '#171717' // neutral-900 — texto principal, barra de cabeçalho
const MUTED = '#737373' // neutral-500 — texto de apoio
const LINE = '#e5e5e5' // neutral-200 — divisórias
const INCOME = '#16a34a' // green-600
const EXPENSE = '#dc2626' // red-600
const ACCENT = '#2a78d6' // azul de marca (linha do gráfico de património)

function formatIssueDate() {
  return new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

// "16 out" — usado no dia de pico de despesa e na tabela de maiores despesas.
function formatShortDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// Cabeçalho: barra escura com a marca à esquerda e o mês de referência à
// direita, mais a data de emissão por baixo — o que se espera de um extrato.
function drawHeader(doc, monthLabel) {
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_WIDTH, 28, 'F')

  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('FinancasApp', MARGIN, 13)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#d4d4d4')
  doc.text('Relatório Mensal', MARGIN, 19)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor('#ffffff')
  doc.text(monthLabel, PAGE_WIDTH - MARGIN, 13, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor('#d4d4d4')
  doc.text(`Emitido em ${formatIssueDate()}`, PAGE_WIDTH - MARGIN, 19, { align: 'right' })

  return 38 + SECTION_GAP // próximo y livre
}

// Uma linha de cartões iguais, com rótulo + valor (+ legenda opcional, para a
// poupança mostrar logo a percentagem ao lado do euro, sem o utilizador ter
// de ir descobrir a conta — era essa a confusão do "15%" sem origem visível.
function drawStatCards(doc, startY, cards, { cardHeight = 24 } = {}) {
  const gap = 4
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardWidth + gap)
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED)
    doc.text(card.label, x + 3.5, startY + 7, { maxWidth: cardWidth - 7 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(card.caption ? 11.5 : 12.5)
    doc.setTextColor(card.color ?? INK)
    doc.text(card.value, x + 3.5, startY + 15.5, { maxWidth: cardWidth - 7 })

    if (card.caption) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(MUTED)
      doc.text(card.caption, x + 3.5, startY + 21, { maxWidth: cardWidth - 7 })
    }
  })

  return startY + cardHeight + SECTION_GAP
}

function drawSectionTitle(doc, startY, title) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(INK)
  doc.text(title, MARGIN, startY)
  return startY + 6
}

// Tabela de "nome + valor + % do total" — serve categorias e, com o mesmo
// formato de linha ({ name, amount }), também a origem por conta.
function breakdownTable(doc, startY, title, breakdown, total, accentColor, { nameHeader = 'Categoria' } = {}) {
  if (breakdown.length === 0) return startY
  const y = drawSectionTitle(doc, startY, title)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [[nameHeader, 'Valor', '% do total']],
    body: breakdown.map((c) => [
      c.name,
      eur(c.amount),
      total > 0 ? `${Math.round((c.amount / total) * 100)}%` : '—',
    ]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2.5, bottom: 2.5, left: 0, right: 2 } },
    headStyles: { textColor: MUTED, fontStyle: 'normal', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 24, halign: 'right', textColor: accentColor },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })
  return doc.lastAutoTable.finalY + SECTION_GAP
}

function topExpensesTable(doc, startY, transactions) {
  const rows = topExpenses(transactions)
  if (rows.length === 0) return startY
  const y = drawSectionTitle(doc, startY, 'Maiores Despesas do Mês')
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Data', 'Descrição', 'Categoria', 'Valor']],
    body: rows.map((r) => [
      formatShortDate(r.occurred_on),
      r.note || '(sem nota)',
      r.categories?.name ?? 'Sem categoria',
      eur(Number(r.amount)),
    ]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: INK, textColor: '#ffffff', fontSize: 8 },
    alternateRowStyles: { fillColor: '#fafafa' },
    columnStyles: {
      0: { cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', textColor: EXPENSE, cellWidth: 26 },
    },
  })
  return doc.lastAutoTable.finalY + SECTION_GAP
}

// Rodapé em todas as páginas: paginação + nota de confidencialidade — só
// sabemos o total de páginas depois de desenhar tudo, por isso corre no fim.
function drawFooters(doc) {
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const y = doc.internal.pageSize.getHeight() - 10
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, y - 4, PAGE_WIDTH - MARGIN, y - 4)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED)
    doc.text('Documento confidencial — gerado pela FinancasApp, para uso pessoal.', MARGIN, y)
    doc.text(`Página ${i} de ${pageCount}`, PAGE_WIDTH - MARGIN, y, { align: 'right' })
  }
}

export function buildMonthlyReportPdf(data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const saldo = netSavings(data.income, data.expense)
  const rate = savingsRate(data.income, data.expense)
  const avgPerDay = averageDailyExpense(data.expense, data.monthKey)
  const peakDay = peakExpenseDay(data.transactions)
  const accountBreakdown = expenseByAccount(data.transactions)

  let y = drawHeader(doc, data.monthLabel)

  // KPIs: a poupança já traz a % do rendimento como legenda, logo ao lado do
  // valor em euros — não é preciso ir a outro sítio descobrir de onde veio.
  y = drawStatCards(doc, y, [
    { label: 'Rendimento Total', value: eur(data.income), color: INCOME },
    { label: 'Despesas Totais', value: eur(data.expense), color: EXPENSE },
    {
      label: 'Poupança Líquida',
      value: eur(saldo),
      color: saldo >= 0 ? INCOME : EXPENSE,
      caption: rate === null ? 'sem receitas no mês' : `${rate}% do rendimento`,
    },
  ])

  // Ritmo de gasto: dois números que o resumo simples nunca mostrava — quanto
  // se gasta "a um ritmo normal" por dia, e o dia que destoou mais desse ritmo.
  y = drawSectionTitle(doc, y, 'Ritmo de Gasto')
  y = drawStatCards(
    doc,
    y,
    [
      { label: 'Gasto médio por dia', value: eur(avgPerDay), color: INK },
      {
        label: 'Pico de despesa',
        value: peakDay ? eur(peakDay.amount) : '—',
        color: peakDay ? EXPENSE : MUTED,
        caption: peakDay ? `dia ${formatShortDate(peakDay.date)}` : 'sem despesas no mês',
      },
    ],
    { cardHeight: peakDay ? 24 : 18 },
  )

  y = breakdownTable(doc, y, 'Despesas por Categoria', data.expenseByCategory, data.expense, EXPENSE)
  if (data.incomeByCategory.length > 0) {
    y = breakdownTable(doc, y, 'Receitas por Categoria', data.incomeByCategory, data.income, INCOME)
  }
  y = breakdownTable(doc, y, 'Origem por Conta', accountBreakdown, data.expense, ACCENT, { nameHeader: 'Conta' })
  topExpensesTable(doc, y, data.transactions)

  drawFooters(doc)
  return doc
}

export function monthlyReportPdfFilename(monthKeyValue) {
  return `relatorio-${monthKeyValue}.pdf`
}

export function downloadMonthlyReportPdf(data, monthKeyValue) {
  const doc = buildMonthlyReportPdf(data)
  doc.save(monthlyReportPdfFilename(monthKeyValue))
}
