'use client'

import { useRouter } from 'next/navigation'
import { User, Trip } from '@/types'

interface Props {
  currentUser: User
  myTrips: Trip[]
  totalPhotos: number
  totalPlaces: number
}

export function MyPageProfile({ currentUser, myTrips, totalPhotos, totalPlaces }: Props) {
  const router = useRouter()

  return (
    <div className="bg-white px-5 pt-7 pb-6 border-b border-stone-100">
      <div className="flex items-center gap-4 mb-5">
        <div className="w-16 h-16 bg-linear-to-br from-orange-400 to-amber-400 rounded-2xl flex items-center justify-center shadow-md shadow-orange-200">
          <span className="text-2xl font-bold text-white">{currentUser.name.charAt(0)}</span>
        </div>
        <div>
          <p className="text-xl font-bold text-stone-900">{currentUser.name}</p>
          <button
            onClick={() => router.push('/profile')}
            className="text-xs text-orange-500 font-medium mt-0.5"
          >
            프로필 편집
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '여행', value: myTrips.length },
          { label: '방문 장소', value: totalPlaces },
          { label: '사진', value: totalPhotos },
        ].map(({ label, value }) => (
          <div key={label} className="bg-stone-50 rounded-2xl py-3 text-center">
            <p className="text-xl font-bold text-stone-900">{value}</p>
            <p className="text-[11px] text-stone-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
