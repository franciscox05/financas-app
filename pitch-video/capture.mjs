// Capturas da app (modo telemóvel, retina) com as utilizadoras demo.
// Uso: servidor da app a correr (npx vite --port 5199) e depois `npm run capture`.
// Atenção: no fim a Rita ACEITA o sushi (muda a BD). Correr o seed-demo.sql antes de
// voltar a capturar, para o movimento voltar a estar "Para confirmar".
// Opcional: SCHEME=light|dark, APP_URL=...
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.demo', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split('=')),
)
const RITA_EMAIL = 'demo-rita@financasapp.com' // mesma password da Sofia (ver seed)
const APP_URL = process.env.APP_URL ?? 'http://localhost:5199'
const SCHEME = process.env.SCHEME ?? 'dark'
const OUT = `public/captures/${SCHEME}`
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()

async function login(email) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: SCHEME,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  })
  // O browser headless não tem push: simula uma subscrição ativa para o sino
  // aparecer ligado (o estado real da app não é tocado).
  await context.grantPermissions(['notifications'], { origin: APP_URL })
  await context.addInitScript(() => {
    const fakeRegistration = { pushManager: { getSubscription: async () => ({ endpoint: 'demo' }) } }
    Object.defineProperty(Notification, 'permission', { get: () => 'granted' })
    Object.defineProperty(ServiceWorkerContainer.prototype, 'ready', {
      get: () => Promise.resolve(fakeRegistration),
    })
  })
  const page = await context.newPage()
  await page.goto(`${APP_URL}/login`)
  await page.fill('input[type=email]', email)
  await page.fill('input[type=password]', env.DEMO_PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForURL(`${APP_URL}/`)
  return { context, page }
}

const shotOf = (page) => async (name, opts = {}) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800) // deixa terminar animações dos gráficos
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
  console.log('captura', name)
}
const goOf = (page) => async (path) => {
  await page.goto(`${APP_URL}${path}`)
  await page.waitForLoadState('networkidle')
}
// Centra um movimento no ecrã (senão os botões dele ficam por baixo da barra de navegação).
// Devolve o scroll final, para repetir a mesma posição noutra captura.
const scrollToCenter = async (page, text) => {
  await page.getByText(text, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: 'center' }))
  return page.evaluate(() => window.scrollY)
}
const friendHref = (page, name) =>
  page.locator('a[href^="/dividas/"]', { hasText: name }).last().getAttribute('href')

// --- Sofia ---------------------------------------------------------------------
{
  const { context, page } = await login(env.DEMO_EMAIL)
  const shot = shotOf(page)
  const go = goOf(page)

  // Registo rápido: sushi de 60 € dividido com 3 amigos, antes e depois de "Dividir por igual".
  await go('/')
  await page.locator('#quick-entry-amount').fill('60')
  await page.getByPlaceholder('Ex: supermercado').fill('Sushi com a malta')
  await page.getByRole('button', { name: 'Dividir com amigos?' }).click()
  const pickers = page.locator('select:has(option[value="__new__"])')
  await pickers.first().waitFor()
  for (const [i, name] of ['Rita Ferreira', 'João', 'Miguel'].entries()) {
    if (i > 0) await page.getByRole('button', { name: 'Adicionar pessoa' }).click()
    await pickers.nth(i).selectOption({ label: name })
  }
  // Escolher um amigo troca a categoria para "Empréstimos": repõe Alimentação à mão.
  await page
    .locator('select', { has: page.locator('option', { hasText: 'Alimentação' }) })
    .first()
    .selectOption({ label: 'Alimentação' })
  // Esconde o cartão "Saldo este mês": o formulário inteiro (até "Registar") cabe no ecrã.
  await page.evaluate(() => window.scrollTo(0, 170))
  await shot('dividir')
  await page.getByRole('button', { name: 'Dividir por igual' }).click()
  await shot('dividir-igual')

  // Amigos: saldos de todos e o conta-corrente com a Rita (sushi à espera dela).
  await go('/dividas')
  await shot('amigos')
  const ritaHref = await friendHref(page, 'Rita Ferreira')
  await go(ritaHref)
  await scrollToCenter(page, 'Sushi com a malta')
  await shot('amigo-rita')

  // Património e modo privacidade (mesma página antes/depois, para um crossfade limpo).
  await go('/patrimonio')
  await shot('patrimonio')
  await page.getByRole('button', { name: 'Esconder valores' }).click()
  await shot('patrimonio-privado')
  await go('/dividas')
  await shot('amigos-privado')
  await page.getByRole('button', { name: 'Mostrar valores' }).click()

  await context.close()
}

// --- Rita: recebe o pedido e aceita -------------------------------------------------
{
  const { context, page } = await login(RITA_EMAIL)
  const shot = shotOf(page)
  const go = goOf(page)

  await go('/dividas')
  await shot('rita-amigos')
  const sofiaHref = await friendHref(page, 'Sofia Martins')
  await go(sofiaHref)
  const y = await scrollToCenter(page, 'Sushi com a malta')
  await shot('rita-sofia')
  await page.getByRole('button', { name: 'Aceitar' }).first().click()
  await page.getByText('Movimento aceite.').waitFor()
  await page.waitForTimeout(1200) // deixa o toast assentar e o saldo atualizar
  // Mesmo scroll de antes, para o crossfade "por confirmar → aceite" ficar no sítio.
  await page.evaluate((top) => window.scrollTo(0, top), y)
  await shot('rita-sofia-aceite')

  await context.close()
}

await browser.close()
