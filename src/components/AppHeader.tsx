'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTravel } from '@/store/travelStore'
import { logoutApi } from '@/api/auth'

export function AppHeader() {
  const router = useRouter()
  const { currentUser, logout } = useTravel()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = async () => {
    await logoutApi()
    logout()
    setDrawerOpen(false)
    router.push('/')
  }

  const navigate = (path: string) => {
    setDrawerOpen(false)
    router.push(path)
  }

  return (
    <>
      <header className="bg-white border-b border-stone-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            {/* 로고 */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              <div className="w-7 h-7 bg-linear-to-br from-orange-400 to-amber-400 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
              </div>
              <span className="text-[18px] font-bold text-stone-900 tracking-tight">Tripus</span>
            </button>

            {/* 햄버거 */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 active:bg-stone-100 transition-colors"
              aria-label="메뉴 열기"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* 드로어 오버레이 */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative w-64 h-full bg-white shadow-2xl flex flex-col">
            {/* 드로어 헤더 */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-stone-100">
              <span className="font-semibold text-stone-900">메뉴</span>
              <button
                onClick={() => setDrawerOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 active:bg-stone-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 로그인 유저 정보 */}
            {currentUser && (
              <div className="px-5 py-4 border-b border-stone-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-linear-to-br from-orange-400 to-amber-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {currentUser.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900 text-sm">{currentUser.name}</p>
                    <p className="text-xs text-stone-400">로그인 중</p>
                  </div>
                </div>
              </div>
            )}

            {/* 메뉴 항목 */}
            <nav className="flex-1 px-3 py-3 space-y-1">
              <DrawerItem
                label="홈"
                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                onClick={() => navigate('/')}
              />
              <DrawerItem
                label="여행 탐색"
                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
                onClick={() => navigate('/trips')}
              />
              {currentUser ? (
                <>
                  <DrawerItem
                    label="마이페이지"
                    icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
                    onClick={() => navigate('/mypage')}
                  />
                  <DrawerItem
                    label="프로필"
                    icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />}
                    onClick={() => navigate('/profile')}
                  />
                </>
              ) : (
                <DrawerItem
                  label="로그인"
                  icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />}
                  onClick={() => navigate('/login')}
                />
              )}
            </nav>

            {/* 로그아웃 */}
            {currentUser && (
              <div className="px-3 pb-6 border-t border-stone-50 pt-3">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-rose-500 active:bg-rose-50 transition-colors text-sm font-medium"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  로그아웃
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function DrawerItem({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-stone-700 active:bg-stone-100 transition-colors text-sm font-medium"
    >
      <svg className="w-4.5 h-4.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {icon}
      </svg>
      {label}
    </button>
  )
}
