'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { AuthProvider, useAuth } from '@/lib/auth'
import Sidebar from '@/components/Sidebar'

const pageTitles: Record<string, string> = {
  '/dashboard': 'ダッシュボード',
  '/dashboard/cases': '案件登録',
  '/dashboard/sales': '売上管理',
  '/dashboard/shipper-pl': '荷主収支管理',
  '/dashboard/vendor-pl': '協力会社別支払管理',
  '/dashboard/annual-pl': '年間損益管理',
  '/dashboard/invoices': '請求書発行',
  '/dashboard/shippers': '荷主マスタ',
  '/dashboard/vendors': '傭車マスタ',
  '/dashboard/vehicles': '車両台帳',
  '/dashboard/employees': '従業員マスタ',
  '/dashboard/users': 'ユーザー管理',
  '/dashboard/settings': 'テナント設定',
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading && !session) router.push('/login')
  }, [loading, session, router])

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400">読み込み中...</div>
  if (!session) return null

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white shadow-sm px-6 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-800">{pageTitles[pathname] || ''}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  )
}
