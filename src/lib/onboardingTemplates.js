// Modelos de categorias e contas do onboarding. Guardam CHAVES de tradução
// (i18n), não texto: o nome final fica na língua escolhida no momento de criar.
export const TEMPLATES = {
  basic: {
    income: ['cat.salary', 'cat.otherIncome'],
    expense: ['cat.food', 'cat.transport', 'cat.home', 'cat.leisure', 'cat.health', 'cat.otherExpense'],
  },
  student: {
    income: ['cat.scholarship', 'cat.allowance', 'cat.salary', 'cat.otherIncome'],
    expense: ['cat.education', 'cat.home', 'cat.food', 'cat.transport', 'cat.leisure', 'cat.health', 'cat.otherExpense'],
  },
  family: {
    income: ['cat.salary', 'cat.otherIncome'],
    expense: [
      'cat.groceries', 'cat.bills', 'cat.home', 'cat.kids', 'cat.transport',
      'cat.health', 'cat.insurance', 'cat.leisure', 'cat.otherExpense',
    ],
  },
  freelancer: {
    income: ['cat.clients', 'cat.otherIncome'],
    expense: [
      'cat.taxes', 'cat.tools', 'cat.equipment', 'cat.transport',
      'cat.food', 'cat.home', 'cat.health', 'cat.otherExpense',
    ],
  },
  blank: {
    income: ['cat.otherIncome'],
    expense: ['cat.otherExpense'],
  },
}

export const TEMPLATE_IDS = Object.keys(TEMPLATES)

// Objetivos que acrescentam categorias com significado próprio:
//  - investir/poupar: categoria de poupança (is_savings): conta como gasto, mas vem à parte;
//  - amigos: Empréstimos/Devoluções (is_lending): ficam fora dos ganhos e gastos do mês.
export function buildCategories(templateId, goals, translate) {
  const tpl = TEMPLATES[templateId] ?? TEMPLATES.basic
  const out = [
    ...tpl.income.map((k) => ({ name: translate(k), type: 'income' })),
    ...tpl.expense.map((k) => ({ name: translate(k), type: 'expense' })),
  ]
  if (goals.includes('invest')) out.push({ name: translate('cat.investments'), type: 'expense', is_savings: true })
  if (goals.includes('save')) out.push({ name: translate('cat.savings'), type: 'expense', is_savings: true })
  if (goals.includes('friends')) {
    out.push({ name: translate('cat.loans'), type: 'expense', is_lending: true })
    out.push({ name: translate('cat.repayments'), type: 'income', is_lending: true })
  }
  // Sem repetidos (por tipo e nome), caso um objetivo repita uma categoria do modelo.
  const seen = new Set()
  return out.filter((c) => {
    const key = `${c.type}:${c.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Contas sugeridas conforme os objetivos. `nameKey` é a chave de tradução do nome.
export function suggestAccounts(goals) {
  const accounts = [
    { id: 'checking', nameKey: 'onb.accounts.checking', type: 'cash' },
    { id: 'cash', nameKey: 'onb.accounts.cash', type: 'cash' },
  ]
  if (goals.includes('save')) accounts.push({ id: 'savings', nameKey: 'onb.accounts.savings', type: 'cash' })
  if (goals.includes('invest')) accounts.push({ id: 'investing', nameKey: 'onb.accounts.investing', type: 'investment' })
  return accounts
}

export const CURRENCIES = [
  'EUR', 'USD', 'GBP', 'BRL', 'CHF', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'MXN', 'ARS', 'COP', 'CLP',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'AED', 'SAR', 'ZAR', 'KRW', 'SGD', 'HKD',
  'IDR', 'THB', 'PHP', 'AOA', 'MZN', 'CVE',
]
