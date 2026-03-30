'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTravel } from '@/store/travelStore'
import { User } from '@/types'

interface Props {
  currentUser: User
}

export function ProfileForm({ currentUser }: Props) {
  const router = useRouter()
  const { login } = useTravel()
  const [name, setName] = useState(currentUser.name)

  const handleSave = () => {
    if (!name.trim()) return
    login({ ...currentUser, name: name.trim() })
    router.push('/mypage')
  }

  return (
    <>
      {/* 아바타 */}
      <div className="flex justify-center mb-8">
        <div className="relative">
          <div className="w-24 h-24 bg-linear-to-br from-orange-400 to-amber-400 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-200">
            <span className="text-4xl font-bold text-white">{name.charAt(0) || currentUser.name.charAt(0)}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-xl shadow-sm flex items-center justify-center border border-stone-100">
            <svg className="w-3.5 h-3.5 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 이름 */}
      <div className="bg-white rounded-2xl px-4 py-3.5 mb-4">
        <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest block mb-2">이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full text-[15px] font-medium text-stone-900 focus:outline-none bg-transparent"
          placeholder="이름을 입력하세요"
          autoFocus
        />
      </div>

      {/* 저장 */}
      <button
        onClick={handleSave}
        disabled={!name.trim() || name.trim() === currentUser.name}
        className="w-full bg-linear-to-r from-orange-500 to-amber-400 text-white py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity disabled:opacity-40 shadow-lg shadow-orange-200"
      >
        저장
      </button>
    </>
  )
}
