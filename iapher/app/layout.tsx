import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Iapher — Meghalaya Youth Wellbeing',
  description: 'A platform for young people in Meghalaya to share their experiences and be heard.',
  manifest: '/manifest.json',
  applicationName: 'Iapher',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Iapher',
  },
  openGraph: {
    title: 'Iapher',
    description: 'Your voice matters — Meghalaya Youth Wellbeing Platform',
    url: 'https://iapher.in',
    siteName: 'Iapher',
    locale: 'en_IN',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  )
}
