'use client'

import { Trip } from '@/types'

interface Props {
  trip: Trip
  onBack: () => void
}

export function TripCoverCard({ trip, onBack }: Props) {
  const totalPhotos = trip.records.reduce((sum, r) => sum + r.photos.length, 0)
  const dayCount = Math.max(1, Math.ceil((Date.now() - trip.startDate) / (1000 * 60 * 60 * 24)))

  return (
    <div className="relative bg-linear-to-br from-orange-500 via-orange-400 to-amber-400 px-4 pt-6 pb-8 overflow-hidden">
      <div className="absolute -top-12 -right-12 w-52 h-52 bg-white/10 rounded-full pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-white/10 rounded-full pointer-events-none" />

      {/* 뒤로가기 */}
      <button
        onClick={onBack}
        className="relative inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1.5 mb-4 text-white/90 text-xs font-medium active:bg-white/30"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        뒤로
      </button>

      <div className="relative mb-5">
        <h1 className="text-[26px] font-bold text-white leading-tight">{trip.name}</h1>
        <p className="text-orange-200 text-sm mt-1">
          {new Date(trip.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 시작
        </p>
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        {[
          { value: trip.records.length, label: '방문한 곳' },
          { value: totalPhotos, label: '사진' },
          { value: dayCount, label: '일째' },
        ].map(({ value, label }) => (
          <div key={label} className="bg-white/20 rounded-2xl py-4 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-white leading-none">{value}</div>
            <div className="text-[11px] text-orange-100 font-medium mt-1.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
