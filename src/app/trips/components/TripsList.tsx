'use client'

import { useRouter } from 'next/navigation'
import { Trip } from '@/types'

interface Props {
  trips: Trip[]
  isLoading: boolean
}

export function TripsList({ trips, isLoading }: Props) {
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
            <div className="h-4 bg-stone-100 rounded-lg w-2/3 mb-2" />
            <div className="h-3 bg-stone-100 rounded-lg w-1/3 mb-3" />
            <div className="flex gap-2">
              <div className="h-5 w-16 bg-stone-100 rounded-full" />
              <div className="h-5 w-14 bg-stone-100 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <p className="text-stone-500 font-medium">검색 결과가 없어요</p>
        <p className="text-stone-400 text-sm mt-1">다른 검색어로 시도해보세요</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {trips.map((trip) => (
        <button
          key={trip.id}
          type="button"
          onClick={() => router.push(`/trip/${trip.id}`)}
          className="w-full text-left bg-white rounded-2xl p-4 shadow-sm shadow-stone-200/60 active:scale-[0.98] transition-transform"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-stone-900 text-[15px] truncate">{trip.name}</p>
              <p className="text-sm text-stone-400 mt-0.5">
                {new Date(trip.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <span className="shrink-0 text-xs text-stone-400 mt-0.5">장소 {trip.records.length}곳</span>
          </div>
          {trip.records.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {trip.records.slice(0, 3).map(r => (
                <span key={r.id} className="text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">
                  {r.location.name}
                </span>
              ))}
              {trip.records.length > 3 && (
                <span className="text-[11px] text-stone-400 self-center">+{trip.records.length - 3}</span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  )
}
