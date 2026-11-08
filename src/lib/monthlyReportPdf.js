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
const PAGE_HEIGHT = 297
const MARGIN = 16 // margens amplas — parte do "acabamento executivo" pedido
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const SECTION_GAP = 11 // espaço vertical entre secções, consistente em todo o documento

// Zona reservada em baixo em TODAS as páginas, para nada (texto nosso ou
// linha de tabela) alguma vez desenhar por cima do rodapé/paginação.
const FOOTER_ZONE = 20
// y onde o conteúdo recomeça numa página nova — a seguir ao cabeçalho fino de
// continuação (ver `drawContinuationHeader`), para nunca ficar colado ao topo.
const CONTINUATION_TOP = 27

// Paleta alinhada com o resto da app (Balance.jsx / NetWorth.jsx).
const INK = '#171717' // neutral-900 — texto principal, cabeçalhos de tabela
const MUTED = '#737373' // neutral-500 — texto de apoio
const LINE = '#e5e5e5' // neutral-200 — divisórias
const STRIPE = '#fafafa' // neutral-50 — linhas alternadas das tabelas
const INCOME = '#16a34a' // green-600
const EXPENSE = '#dc2626' // red-600
const ACCENT = '#2a78d6' // azul de marca (linha do gráfico de património)
const WATERMARK_GRAY = '#9ca3af' // neutral-400 — só visível pela opacidade baixa, não pela cor

// Estilo partilhado por TODAS as tabelas do relatório — um só vocabulário
// visual (cabeçalho escuro institucional, linha alternada, altura de linha
// confortável) em vez de cada secção inventar o seu, que era o que tornava
// o documento anterior "denso e confuso".
const TABLE_BASE = {
  theme: 'striped',
  styles: { fontSize: 9, cellPadding: 3.2, textColor: INK },
  headStyles: { fillColor: INK, textColor: '#ffffff', fontStyle: 'bold', fontSize: 8.5 },
  alternateRowStyles: { fillColor: STRIPE },
}

function formatIssueDate() {
  return new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
}

// "16 out" — usado no dia de pico de despesa, maiores despesas e extrato.
function formatShortDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

// Cabeçalho da 1.ª página: barra escura com a marca e o mês. Páginas
// seguintes (ver `drawContinuationHeader`) não repetem esta barra inteira —
// ficaria redundante numa 3.ª ou 4.ª página de um extrato longo.
function drawHeader(doc, monthLabel) {
  doc.setFillColor(INK)
  doc.rect(0, 0, PAGE_WIDTH, 30, 'F')

  doc.setTextColor('#ffffff')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text('FinancasApp', MARGIN, 14)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#d4d4d4')
  doc.text('Relatório Mensal', MARGIN, 20.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor('#ffffff')
  doc.text(monthLabel, PAGE_WIDTH - MARGIN, 14, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor('#d4d4d4')
  doc.text(`Emitido em ${formatIssueDate()}`, PAGE_WIDTH - MARGIN, 20.5, { align: 'right' })

  return 30 + SECTION_GAP // próximo y livre
}

// Linha fina no topo de uma página de continuação (2.ª em diante): só a
// marca, o mês e uma régua — mantém a orientação sem repetir a barra inteira.
// Devolve CONTINUATION_TOP, o y onde o conteúdo dessa página pode começar.
function drawContinuationHeader(doc, monthLabel) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(INK)
  doc.text('FinancasApp', MARGIN, 15)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(MUTED)
  doc.text(`Relatório Mensal · ${monthLabel}`, PAGE_WIDTH - MARGIN, 15, { align: 'right' })

  doc.setDrawColor(LINE)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, 19.5, PAGE_WIDTH - MARGIN, 19.5)

  return CONTINUATION_TOP
}

// Garante espaço digno antes de começar um bloco: se o que falta de página
// não chega para `neededHeight`, vira a página em vez de deixar um título ou
// um cartão cortado a meio. É a verificação pedida — altura restante contra
// `neededHeight`, antes de desenhar, nunca depois.
function ensureSpace(doc, y, neededHeight, monthLabel) {
  if (y + neededHeight <= PAGE_HEIGHT - FOOTER_ZONE) return y
  doc.addPage()
  return drawContinuationHeader(doc, monthLabel)
}

// Uma linha de cartões iguais, com rótulo + valor (+ legenda opcional, para a
// poupança mostrar logo a percentagem ao lado do euro, sem o utilizador ter
// de ir descobrir a conta — era essa a confusão do "15%" sem origem visível.
// Cada cartão leva uma tira de cor à esquerda (o mesmo papel visual de um
// indicador de KPI num dashboard), em vez de só o texto colorido — mais
// arejado e com hierarquia mais clara ao primeiro olhar.
function drawStatCards(doc, startY, cards, { cardHeight = 26 } = {}) {
  const gap = 5
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length
  const accentWidth = 1.4

  cards.forEach((card, i) => {
    const x = MARGIN + i * (cardWidth + gap)
    const accentColor = card.color ?? MUTED

    doc.setDrawColor(LINE)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2.5, 2.5, 'S')

    doc.setFillColor(accentColor)
    doc.roundedRect(x, startY + 2.5, accentWidth, cardHeight - 5, 0.7, 0.7, 'F')

    const textX = x + 5.5
    const textMaxWidth = cardWidth - 8

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(MUTED)
    doc.text(card.label, textX, startY + 8, { maxWidth: textMaxWidth })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(card.caption ? 12 : 13)
    doc.setTextColor(INK)
    doc.text(card.value, textX, startY + 17, { maxWidth: textMaxWidth })

    if (card.caption) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(accentColor)
      doc.text(card.caption, textX, startY + 22.5, { maxWidth: textMaxWidth })
    }
  })

  return startY + cardHeight + SECTION_GAP
}

function drawSectionTitle(doc, startY, title) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text(title, MARGIN, startY)
  return startY + 7
}

// Opções comuns a toda tabela do relatório: margem inferior igual a
// `FOOTER_ZONE` (para a própria tabela nunca desenhar uma linha por cima do
// rodapé) e o cabeçalho de continuação a aparecer sempre que ESTA tabela,
// por ser longa, force internamente uma página nova — não só quando nós
// decidimos mudar de página antes dela (isso já é tratado por `ensureSpace`).
function tableDefaults(doc, monthLabel) {
  const startPage = doc.getNumberOfPages()
  return {
    ...TABLE_BASE,
    margin: { top: CONTINUATION_TOP, left: MARGIN, right: MARGIN, bottom: FOOTER_ZONE },
    didDrawPage(hookData) {
      if (hookData.pageNumber > startPage) drawContinuationHeader(doc, monthLabel)
    },
  }
}

// Tabela de "nome + valor + % do total" — serve categorias e, com o mesmo
// formato de linha ({ name, amount }), também a origem por conta. Curta por
// natureza (poucas categorias/contas): `pageBreak: 'avoid'` tenta pô-la
// inteira na página onde começa, ou passá-la toda para a seguinte, em vez de
// deixar uma ou duas linhas perdidas no fim de uma página.
function breakdownTable(doc, startY, monthLabel, title, breakdown, total, accentColor, { nameHeader = 'Categoria' } = {}) {
  if (breakdown.length === 0) return startY
  let y = ensureSpace(doc, startY, 28, monthLabel)
  y = drawSectionTitle(doc, y, title)
  autoTable(doc, {
    ...tableDefaults(doc, monthLabel),
    startY: y,
    pageBreak: 'avoid',
    head: [[nameHeader, 'Valor', '% do total']],
    body: breakdown.map((c) => [
      c.name,
      eur(c.amount),
      total > 0 ? `${Math.round((c.amount / total) * 100)}%` : '—',
    ]),
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 26, halign: 'right', textColor: accentColor, fontStyle: 'bold' },
    },
  })
  return doc.lastAutoTable.finalY + SECTION_GAP
}

function topExpensesTable(doc, startY, monthLabel, transactions) {
  const rows = topExpenses(transactions)
  if (rows.length === 0) return startY
  let y = ensureSpace(doc, startY, 28, monthLabel)
  y = drawSectionTitle(doc, y, 'Maiores Despesas do Mês')
  autoTable(doc, {
    ...tableDefaults(doc, monthLabel),
    startY: y,
    pageBreak: 'avoid',
    head: [['Data', 'Descrição', 'Categoria', 'Valor']],
    body: rows.map((r) => [
      formatShortDate(r.occurred_on),
      r.note || '(sem nota)',
      r.categories?.name ?? 'Sem categoria',
      eur(Number(r.amount)),
    ]),
    columnStyles: {
      0: { cellWidth: 20 },
      3: { halign: 'right', fontStyle: 'bold', textColor: EXPENSE, cellWidth: 28 },
    },
  })
  return doc.lastAutoTable.finalY + SECTION_GAP
}

// Extrato integral: TODOS os movimentos do mês, por ordem cronológica — não
// só os maiores. Deliberadamente mais sóbrio que o resto do documento (sem
// setas/símbolos coloridos): é a secção mais longa e mais lida por cima a
// cima, por isso o peso visual fica no texto "Receita"/"Despesa" simples, e a
// cor só aparece no sinal +/- do valor, nunca a dobrar com ícones por cima.
// Pode legitimamente ocupar várias páginas (é um extrato a sério); por isso
// usa `pageBreak: 'auto'` (o default) em vez de 'avoid', e é a única tabela a
// que vale a pena dar `showHead: 'everyPage'`, para o cabeçalho de colunas
// voltar no topo de cada página que continue a lista.
function allMovementsTable(doc, startY, monthLabel, transactions) {
  if (transactions.length === 0) return startY
  const sorted = [...transactions].sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : a.occurred_on > b.occurred_on ? 1 : 0))

  let y = ensureSpace(doc, startY, 28, monthLabel)
  y = drawSectionTitle(doc, y, 'Extrato Integral do Mês')
  autoTable(doc, {
    ...tableDefaults(doc, monthLabel),
    startY: y,
    showHead: 'everyPage',
    styles: { ...TABLE_BASE.styles, fontSize: 8.5 },
    head: [['Data', 'Tipo', 'Descrição', 'Categoria', 'Conta', 'Valor']],
    body: sorted.map((tx) => {
      const isIncome = tx.type === 'income'
      return [
        formatShortDate(tx.occurred_on),
        isIncome ? 'Receita' : 'Despesa',
        tx.note || '(sem nota)',
        tx.categories?.name ?? 'Sem categoria',
        tx.accounts?.name ?? '—',
        `${isIncome ? '+' : '-'} ${eur(Number(tx.amount))}`,
      ]
    }),
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 20, textColor: MUTED },
      4: { cellWidth: 26 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
    },
  })
  return doc.lastAutoTable.finalY + SECTION_GAP
}

// Marca d'água discreta: tão transparente que nunca compete com texto ou
// tabelas por cima — é por isso que é seguro desenhá-la depois de tudo o
// resto, em vez de precisar de ficar "atrás" numa camada à parte (o jsPDF não
// tem camadas; a esta opacidade a ordem de desenho deixa de se notar).
function drawWatermark(doc, pageCount) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.04 }))
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(58)
    doc.setTextColor(WATERMARK_GRAY)
    doc.text('FinancasApp', PAGE_WIDTH / 2, PAGE_HEIGHT / 2, { align: 'center', angle: 35 })
    doc.restoreGraphicsState()
  }
}

// Rodapé em todas as páginas: paginação + nota de confidencialidade — só
// sabemos o total de páginas depois de desenhar tudo, por isso corre no fim,
// depois da marca de água (para o texto do rodapé ficar sempre nítido).
function drawFooters(doc, pageCount) {
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const y = PAGE_HEIGHT - 11
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
  const monthLabel = data.monthLabel
  const saldo = netSavings(data.income, data.expense)
  const rate = savingsRate(data.income, data.expense)
  const avgPerDay = averageDailyExpense(data.expense, data.monthKey)
  const peakDay = peakExpenseDay(data.transactions)
  const accountBreakdown = expenseByAccount(data.transactions)

  let y = drawHeader(doc, monthLabel)

  // KPIs: a poupança já traz a % do rendimento como legenda, logo ao lado do
  // valor em euros — não é preciso ir a outro sítio descobrir de onde veio.
  const kpiCardHeight = 26
  y = ensureSpace(doc, y, kpiCardHeight, monthLabel)
  y = drawStatCards(
    doc,
    y,
    [
      { label: 'Rendimento Total', value: eur(data.income), color: INCOME },
      { label: 'Despesas Totais', value: eur(data.expense), color: EXPENSE },
      {
        label: 'Poupança Líquida',
        value: eur(saldo),
        color: saldo >= 0 ? INCOME : EXPENSE,
        caption: rate === null ? 'sem receitas no mês' : `${rate}% do rendimento`,
      },
    ],
    { cardHeight: kpiCardHeight },
  )

  // Ritmo de gasto: dois números que o resumo simples nunca mostrava — quanto
  // se gasta "a um ritmo normal" por dia, e o dia que destoou mais desse ritmo.
  const paceCardHeight = peakDay ? 26 : 20
  y = ensureSpace(doc, y, 7 + paceCardHeight, monthLabel)
  y = drawSectionTitle(doc, y, 'Ritmo de Gasto')
  y = drawStatCards(
    doc,
    y,
    [
      { label: 'Gasto médio por dia', value: eur(avgPerDay), color: ACCENT },
      {
        label: 'Pico de despesa',
        value: peakDay ? eur(peakDay.amount) : '—',
        color: peakDay ? EXPENSE : MUTED,
        caption: peakDay ? `dia ${formatShortDate(peakDay.date)}` : 'sem despesas no mês',
      },
    ],
    { cardHeight: paceCardHeight },
  )

  y = breakdownTable(doc, y, monthLabel, 'Despesas por Categoria', data.expenseByCategory, data.expense, EXPENSE)
  if (data.incomeByCategory.length > 0) {
    y = breakdownTable(doc, y, monthLabel, 'Receitas por Categoria', data.incomeByCategory, data.income, INCOME)
  }
  y = breakdownTable(doc, y, monthLabel, 'Origem por Conta', accountBreakdown, data.expense, ACCENT, {
    nameHeader: 'Conta',
  })
  y = topExpensesTable(doc, y, monthLabel, data.transactions)
  allMovementsTable(doc, y, monthLabel, data.transactions)

  const pageCount = doc.getNumberOfPages()
  drawWatermark(doc, pageCount)
  drawFooters(doc, pageCount)
  return doc
}

export function monthlyReportPdfFilename(monthKeyValue) {
  return `relatorio-${monthKeyValue}.pdf`
}

export function downloadMonthlyReportPdf(data, monthKeyValue) {
  const doc = buildMonthlyReportPdf(data)
  doc.save(monthlyReportPdfFilename(monthKeyValue))
}
