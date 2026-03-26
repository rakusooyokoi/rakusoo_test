'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth'

const allMenuItems = [
  { path: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { path: '/dashboard/cases', label: '案件登録', icon: '📋' },
  { path: '/dashboard/sales', label: '売上管理', icon: '💰' },
  { path: '/dashboard/shipper-pl', label: '荷主収支管理', icon: '📈' },
  { path: '/dashboard/vendor-pl', label: '協力会社別支払管理', icon: '📉' },
  { path: '/dashboard/annual-pl', label: '年間損益管理', icon: '📅' },
  { path: '/dashboard/invoices', label: '請求書発行', icon: '📄' },
  { divider: true, label: 'マスタ管理' },
  { path: '/dashboard/shippers', label: '荷主マスタ', icon: '🏭' },
  { path: '/dashboard/vendors', label: '傭車マスタ', icon: '🚛' },
  { path: '/dashboard/vehicles', label: '車両台帳', icon: '🚚' },
  { path: '/dashboard/employees', label: '従業員マスタ', icon: '👤' },
  { divider: true, label: '設定', adminOnly: true },
  { path: '/dashboard/users', label: 'ユーザー管理', icon: '👥', adminOnly: true },
  { path: '/dashboard/settings', label: 'テナント設定', icon: '⚙️', adminOnly: true },
] as const

export default function Sidebar() {
  const pathname = usePathname()
  const { role, logout } = useAuth()
  const [open, setOpen] = useState(true)
  const isAdmin = role === 'admin'

  const menuItems = isAdmin ? allMenuItems : allMenuItems.filter(item => !('adminOnly' in item && item.adminOnly))

  return (
    <aside className={`${open ? 'w-60' : 'w-16'} bg-gray-900 text-white transition-all duration-200 flex flex-col`}>
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {open && <span className="text-lg font-bold">rakusoo</span>}
        <button onClick={() => setOpen(!open)} className="text-gray-400 hover:text-white">
          {open ? '◀' : '▶'}
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {menuItems.map((item, i) => (
          'divider' in item && item.divider ? (
            <div key={`d-${i}`} className="px-4 py-2 mt-2">
              {open ? <span className="text-xs text-gray-500 uppercase">{item.label}</span> : <hr className="border-gray-700" />}
            </div>
          ) : 'path' in item ? (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-4 py-2.5 text-sm transition-colors ${
                pathname === item.path ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {open && <span className="ml-3">{item.label}</span>}
            </Link>
          ) : null
        ))}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <button onClick={logout} className="w-full text-left text-sm text-gray-400 hover:text-white flex items-center">
          <span>🚪</span>
          {open && <span className="ml-3">ログアウト</span>}
        </button>
      </div>
    </aside>
  )
}
