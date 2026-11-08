// Relatório mensal em PDF, com aspeto de extrato bancário/relatório executivo.
// Gerado inteiramente no cliente (jsPDF + jspdf-autotable) — sem pedidos novos
// à base de dados, a partir dos mesmos dados já calculados para o ecrã
// (ver monthlyReport.js), para nunca discordar do que o utilizador vê.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { eur } from './format.js'
import { netSavings, topExpenses } from './monthlyReport.js'

const PAGE_WIDTH = 210 // A4, mm
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

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

  return 38 // próximo y livre
}

// Grelha de 4 KPIs, cada um num cartão próprio com rótulo + valor — o mesmo
// papel visual dos 3 cartões do Balanço, só que em PDF.
function drawKpiGrid(doc, startY, { income, expense, saldo, rate }) {
  const gap = 4
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4
  const cardHeight = 22
  const kpis = [
    { label: 'Rendimento Total', value: eur(income), color: INCOME },
    { label: 'Despesas Totais', value: eur(expense), color: EXPENSE },
    { label: 'Saldo Líquido', value: eur(saldo), color: saldo >= 0 ? INCOME : EXPENSE },
    { label: 'Taxa de Poupança', value: rate === null ? '—' : `${rate}%`, color: ACCENT },
  ]

  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (cardWidth + gap)
    doc.setDrawColor(LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'S')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED)
    doc.text(kpi.label, x + 3, startY + 7, { maxWidth: cardWidth - 6 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(kpi.color)
    doc.text(kpi.value, x + 3, startY + 16.5, { maxWidth: cardWidth - 6 })
  })

  return startY + cardHeight + 10
}

function drawSectionTitle(doc, startY, title) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(INK)
  doc.text(title, MARGIN, startY)
  return startY + 5
}

// Tabela de categorias com valor + % do total — mesma lógica de
// `categorySection` em monthlyReport.js, formatada para autoTable.
function categoryTable(doc, startY, title, breakdown, total, accentColor) {
  if (breakdown.length === 0) return startY
  const y = drawSectionTitle(doc, startY, title)
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Categoria', 'Valor', '% do total']],
    body: breakdown.map((c) => [
      c.name,
      eur(c.amount),
      total > 0 ? `${Math.round((c.amount / total) * 100)}%` : '—',
    ]),
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 0, right: 2 } },
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
  return doc.lastAutoTable.finalY + 8
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
      new Date(`${r.occurred_on}T00:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' }),
      r.note || '(sem nota)',
      r.categories?.name ?? 'Sem categoria',
      eur(Number(r.amount)),
    ]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: INK, textColor: '#ffffff', fontSize: 8 },
    alternateRowStyles: { fillColor: '#fafafa' },
    columnStyles: {
      0: { cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', textColor: EXPENSE, cellWidth: 26 },
    },
  })
  return doc.lastAutoTable.finalY + 8
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
  const rate = data.income > 0 ? Math.round((saldo / data.income) * 100) : null

  let y = drawHeader(doc, data.monthLabel)
  y = drawKpiGrid(doc, y, { income: data.income, expense: data.expense, saldo, rate })
  y = categoryTable(doc, y, 'Despesas por Categoria', data.expenseByCategory, data.expense, EXPENSE)
  if (data.incomeByCategory.length > 0) {
    y = categoryTable(doc, y, 'Receitas por Categoria', data.incomeByCategory, data.income, INCOME)
  }
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
