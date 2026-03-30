'use client'

import { useRouter } from 'next/navigation'
import { useTravel } from '@/store/travelStore'
import { loginWithProvider } from '@/api/auth'

export function LoginForm() {
  const router = useRouter()
  const { login } = useTravel()

  const handleLogin = async (provider: 'kakao' | 'google') => {
    const user = await loginWithProvider(provider)
    login(user)
    router.push('/mypage')
  }

  return (
    <div className="w-full max-w-sm">
      {/* 로고 */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-16 h-16 bg-linear-to-br from-orange-400 to-amber-400 rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-orange-200 mb-4">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-stone-900">Tripus에 오신 것을</h1>
        <p className="text-2xl font-bold text-stone-900">환영해요</p>
        <p className="text-sm text-stone-400 mt-2">SNS 계정으로 간편하게 시작하세요</p>
      </div>

      {/* 로그인 버튼 */}
      <div className="space-y-3">
        {/* 카카오 */}
        <button
          onClick={() => handleLogin('kakao')}
          className="w-full flex items-center justify-center gap-3 bg-[#FEE500] text-[#191919] py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.477 2 10.9c0 2.795 1.617 5.25 4.083 6.773L5.1 21l4.8-2.55A11.16 11.16 0 0012 18.8c5.523 0 10-3.477 10-7.9S17.523 3 12 3z" />
          </svg>
          카카오로 계속하기
        </button>

        {/* 구글 */}
        <button
          onClick={() => handleLogin('google')}
          className="w-full flex items-center justify-center gap-3 bg-white text-stone-700 py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity shadow-sm border border-stone-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google로 계속하기
        </button>
      </div>

      <p className="text-center text-xs text-stone-400 mt-8 leading-relaxed">
        로그인 시 서비스 이용약관 및<br />개인정보 처리방침에 동의하게 됩니다
      </p>
    </div>
  )
}
