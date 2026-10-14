// Capturas da app (modo telemóvel, retina) com o utilizador demo.
// Uso: servidor da app a correr (npx vite --port 5199) e depois `npm run capture`.
// Opcional: SCHEME=light|dark, APP_URL=...
import { readFileSync, mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.demo', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('=')),
)
const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:5199'
const SCHEME = process.env.SCHEME ?? 'dark'
const OUT = `public/captures/${SCHEME}`
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
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

const shot = async (name, opts = {}) => {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800) // deixa terminar animações dos gráficos
  await page.screenshot({ path: `${OUT}/${name}.png`, ...opts })
  console.log('captura', name)
}
const go = async (path) => {
  await page.goto(`${APP_URL}${path}`)
  await page.waitForLoadState('networkidle')
}

await go('/login')
await page.fill('input[type=email]', env.DEMO_EMAIL)
await page.fill('input[type=password]', env.DEMO_PASSWORD)
await page.click('button[type=submit]')
await page.waitForURL(`${APP_URL}/`)

// Registo + lista de transações (página longa, para fazer "scroll" no vídeo).
await go('/')
await shot('registo')
await shot('registo-full', { fullPage: true })

await go('/balanco')
await shot('balanco')
await shot('balanco-full', { fullPage: true })

// Património: total, contas e evolução. Depois o histórico de uma conta.
await go('/patrimonio')
await shot('patrimonio')
await page.getByText('Conta à Ordem', { exact: true }).first().click()
await page.getByRole('heading', { name: 'Conta à Ordem' }).waitFor()
await shot('conta-ordem')

// Dívidas: aviso de atraso, pagamento parcial com "Anular".
await go('/dividas')
await shot('dividas')

// Modo privacidade: mesma página antes/depois, para um crossfade limpo.
await go('/patrimonio')
await page.getByRole('button', { name: 'Esconder valores' }).click()
await shot('patrimonio-privado')
await go('/dividas')
await shot('dividas-privado')
await page.getByRole('button', { name: 'Mostrar valores' }).click()

await browser.close()
