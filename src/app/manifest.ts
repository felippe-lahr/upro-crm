import type { MetadataRoute } from 'next'

// Web App Manifest — torna a inbox instalável como app no celular (PWA).
// Nome e ícone podem ser alterados aqui a qualquer momento.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'UProCRM',
    short_name: 'UProCRM',
    description: 'Atendimento WhatsApp — CRM, conversas e bot de IA.',
    // O atendente cai direto nas conversas ao abrir o app.
    start_url: '/conversations',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
    ]
  }
}
