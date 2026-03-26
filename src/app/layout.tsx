import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'rakusoo - 運送業務管理システム',
  description: '運送業向けSaaS型業務管理システム',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  )
}
