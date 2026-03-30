'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchPublicTrips } from '@/api/trips'

export function HomeTripList() {
  const router = useRouter()

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['public-trips'],
    queryFn: () => fetchPublicTrips(),
  })

  return (
    <section className="max-w-lg mx-auto px-4 pt-7 pb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">최근 여행 기록</h2>
        <button
          onClick={() => router.push('/trips')}
          className="text-xs text-orange-500 font-medium"
        >
          전체 보기
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-stone-100 rounded-lg w-2/3 mb-2" />
              <div className="h-3 bg-stone-100 rounded-lg w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {trips.slice(0, 6).map((trip) => (
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
                    <span className="text-[11px] text-stone-400">+{trip.records.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
