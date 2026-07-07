// Service worker mínimo — habilita a instalação do PWA (Add to Home Screen).
// Estratégia network-first simples: não faz cache agressivo (o app é dinâmico),
// apenas garante o requisito de SW instalável. Push será adicionado na Fase B.
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
