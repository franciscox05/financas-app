import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'
import PrivacyProvider from './components/PrivacyProvider.jsx'

// Sem isto, o vite-plugin-pwa só injeta um registo minimo que nunca verifica
// se ha uma versao nova — por isso a app instalada (sobretudo no iOS) ficava
// presa em builds antigas ate reinstalar manualmente. Com registerType
// "autoUpdate" (ver vite.config.js), isto deteta e aplica atualizacoes
// sozinho, recarregando a pagina quando ha uma versao nova disponivel.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => registration.update(), 60 * 60 * 1000)
  },
})

// No Android o toque longo chega como "contextmenu" e o CSS não o trava. Fica
// de fora o rato (botão direito) e os campos de escrita (colar).
if (window.matchMedia('(pointer: coarse)').matches) {
  document.addEventListener('contextmenu', (e) => {
    if (!e.target.closest('input, textarea, [contenteditable="true"]')) e.preventDefault()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivacyProvider>
      <App />
    </PrivacyProvider>
  </StrictMode>,
)
