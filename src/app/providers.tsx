'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useTravel } from '@/store/travelStore'
import { getMe } from '@/api/auth'

// 앱 마운트 시 서버 세션 쿠키로 로그인 상태 복구
function SessionRestorer() {
  const { currentUser, login } = useTravel()

  useEffect(() => {
    if (!currentUser) {
      getMe().then(user => { if (user) login(user) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <SessionRestorer />
      {children}
    </QueryClientProvider>
  )
}
