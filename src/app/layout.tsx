import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "UProCRM — CRM para WhatsApp",
  description: "CRM multi-tenant para WhatsApp Business com bot de IA, funil de vendas e disparos.",
  manifest: "/manifest.webmanifest",
  // Favicon/ícones vêm de app/favicon.ico, app/icon.png e app/apple-icon.png (convenção do Next).
  // Faz o app instalado (iOS) abrir em tela cheia com o nome "UProCRM".
  appleWebApp: { capable: true, title: "UProCRM", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2563eb",
  // "auto" mantém o conteúdo dentro da área segura do iOS (sem cortar as bordas
  // no PWA instalado). "cover" empurrava o conteúdo para baixo do notch/cantos.
  viewportFit: "auto",
};

// Registra o service worker para habilitar a instalação como app (PWA).
const swRegister = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

// Apply the persisted theme before paint to avoid a flash of the wrong theme.
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('theme');
    if (!t) t = 'dark';
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swRegister }} />
      </head>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
