'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '🏠' },
  { href: '/keywords', label: 'キーワード収集', icon: '🔍' },
  { href: '/write', label: '記事生成', icon: '✍️' },
  { href: '/image', label: '画像編集', icon: '🖼️' },
  { href: '/post', label: '投稿・通知', icon: '📤' },
  { href: '/articles', label: '記事一覧', icon: '📋' },
  { href: '/settings', label: '設定', icon: '⚙️' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-stone-900 text-stone-100 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="px-5 py-6 border-b border-stone-700">
        <h1 className="text-lg font-bold text-rose-300 tracking-wide">IMIEL</h1>
        <p className="text-xs text-stone-500 mt-0.5">コンテンツ管理</p>
      </div>

      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-rose-700 text-white font-medium'
                      : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
                  }`}
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-5 py-4 border-t border-stone-700">
        <p className="text-xs text-stone-600">IMIEL Team v1.0</p>
      </div>
    </aside>
  )
}
