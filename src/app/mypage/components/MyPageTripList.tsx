'use client'

import { useRouter } from 'next/navigation'
import { Trip } from '@/types'

interface Props {
  trips: Trip[]
  onAddRecord: (tripId: string) => void
}

export function MyPageTripList({ trips, onAddRecord }: Props) {
  const router = useRouter()

  return (
    <div className="px-4 pt-5">
      <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-3">내 여행</h2>

      {trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-stone-400 text-sm">아직 여행 기록이 없어요</p>
          <p className="text-stone-400 text-sm">아래 버튼으로 첫 여행을 시작해보세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...trips].reverse().map((trip) => {
            const photos = trip.records.reduce((s, r) => s + r.photos.length, 0)
            return (
              <div key={trip.id} className="bg-white rounded-2xl shadow-sm shadow-stone-200/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => router.push(`/trip/${trip.id}`)}
                  className="w-full text-left px-4 pt-4 pb-3"
                >
                  <p className="font-semibold text-stone-900 text-[15px] truncate">{trip.name}</p>
                  <p className="text-sm text-stone-400 mt-0.5">
                    {new Date(trip.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {' · '}장소 {trip.records.length}곳{photos > 0 && ` · 사진 ${photos}장`}
                  </p>
                </button>
                <div className="border-t border-stone-50 px-4 py-2.5 flex justify-end">
                  <button
                    onClick={() => onAddRecord(trip.id)}
                    className="text-xs text-orange-500 font-semibold active:opacity-70"
                  >
                    + 기록 추가
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
