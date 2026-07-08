// Service worker: instalação do PWA + notificações push.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Passthrough: deixa a rede responder; sem cache offline por enquanto.
  event.respondWith(fetch(event.request).catch(() => Response.error()))
})

// Recebe o push e mostra a notificação.
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || 'UProCRM'
  const options = {
    body: data.body || 'Nova mensagem',
    icon: '/logo.svg',
    badge: '/logo.svg',
    tag: data.tag || undefined,
    data: { url: data.url || '/conversations' }
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// Ao clicar, foca uma aba aberta do app ou abre a conversa.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/conversations'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
