import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.skipWaiting()
self.addEventListener('activate', () => self.clients.claim())

self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FinancasApp', {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const client =
        windows.find((c) => c.focused) ?? windows.find((c) => c.visibilityState === 'visible') ?? windows[0]
      if (client) {
        try {
          // focus() primeiro: precisa do gesto do utilizador, que navigate() pode consumir.
          await client.focus()
          await client.navigate(url)
          return
        } catch {
          // focus/navigate podem falhar (ex.: janela de outra origem): abre uma nova.
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})
