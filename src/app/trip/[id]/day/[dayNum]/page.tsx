'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchTripById } from '@/api/trips'
import { useTravel } from '@/store/travelStore'
import { TripRecordModal } from '@/components/TripRecordModal'
import { TravelMap } from '@/components/TravelMap'
import { AppHeader } from '@/components/AppHeader'
import { LocationSearchResult, TravelRecord } from '@/types'

// ── 날짜별 그룹핑 유틸 ────────────────────────────────────────────────────────
interface DayGroup {
  dayNum: number
  dateKey: string
  dateLabel: string
  dayDateStr: string  // yyyy-MM-dd (폼 초기 날짜)
  records: TravelRecord[]
}

function groupByDay(records: TravelRecord[]): DayGroup[] {
  const groups: DayGroup[] = []
  let currentKey = ''
  let dayNum = 0

  for (const record of records) {
    const date = new Date(record.timestamp)
    const key = date.toDateString()

    if (key !== currentKey) {
      currentKey = key
      dayNum++
      groups.push({
        dayNum,
        dateKey: key,
        dateLabel: date.toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        }),
        dayDateStr: date.toISOString().slice(0, 10),
        records: [record],
      })
    } else {
      groups[groups.length - 1].records.push(record)
    }
  }

  return groups
}

// ── 페이지 ────────────────────────────────────────────────────────────────────
export default function DayDetailPage({
  params,
}: {
  params: Promise<{ id: string; dayNum: string }>
}) {
  const { id, dayNum: dayNumStr } = use(params)
  const dayNum = parseInt(dayNumStr, 10)
  const router = useRouter()
  const { currentUser } = useTravel()

  const [modalLocation, setModalLocation] = useState<LocationSearchResult | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => fetchTripById(id),
  })

  const isOwner = !!currentUser && trip?.userId === currentUser.id

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <AppHeader />
        <div className="max-w-lg mx-auto px-4 pt-8 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-5 bg-stone-100 rounded-lg w-1/2 mb-2" />
              <div className="h-3 bg-stone-100 rounded-lg w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!trip) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)]">
          <p className="text-stone-500">여행을 찾을 수 없어요</p>
          <button onClick={() => router.push('/')} className="mt-4 text-orange-500 font-medium text-sm">
            홈으로
          </button>
        </div>
      </div>
    )
  }

  const chronologicalRecords = [...trip.records].sort((a, b) => a.timestamp - b.timestamp)
  const groups = groupByDay(chronologicalRecords)
  const dayGroup = groups.find(g => g.dayNum === dayNum)

  if (!dayGroup) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)]">
          <p className="text-stone-500">해당 날짜를 찾을 수 없어요</p>
          <button onClick={() => router.back()} className="mt-4 text-orange-500 font-medium text-sm">
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  const handleMapClick = (location: LocationSearchResult) => {
    if (!isOwner) return
    setModalLocation(location)
    setModalOpen(true)
  }

  return (
    <div className="min-h-dvh bg-stone-100">
      <AppHeader />

      <TripRecordModal
        isOpen={modalOpen}
        tripId={trip.id}
        onClose={() => { setModalOpen(false); setModalLocation(null) }}
        initialLocation={modalLocation}
        initialDate={dayGroup.dayDateStr}
      />

      <main className="max-w-lg mx-auto bg-stone-100 pb-28">
        {/* Day 헤더 */}
        <div className="bg-white px-4 pt-4 pb-5">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-orange-500 font-medium text-sm mb-4 active:opacity-60 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {trip.name}
          </button>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-sm font-bold text-white bg-orange-500 rounded-full px-3 py-0.5">
              Day {dayNum}
            </span>
            <span className="text-stone-800 font-semibold">{dayGroup.dateLabel}</span>
          </div>
          <p className="text-xs text-stone-400">{dayGroup.records.length}개 장소</p>
        </div>

        <div className="h-2.5 bg-stone-100" />

        {/* 지도 */}
        <div className="bg-white">
          <TravelMap
            records={dayGroup.records}
            onRecordClick={() => {}}
            onMapClick={isOwner ? handleMapClick : undefined}
            showRoute={dayGroup.records.length > 0}
            className="w-full h-72"
          />
        </div>

        <div className="h-2.5 bg-stone-100" />

        {/* 기록 목록 */}
        <div className="bg-white">
          <div className="px-4 py-3.5 border-b border-stone-50">
            <h3 className="font-semibold text-stone-900 text-sm">
              기록 <span className="text-stone-400 font-normal">{dayGroup.records.length}</span>
            </h3>
          </div>
          {dayGroup.records.map((record, idx) => (
            <button
              key={record.id}
              onClick={() => router.push(`/trip/${id}/record/${record.id}`)}
              className="w-full flex items-center gap-3.5 px-4 py-3.5 border-b border-stone-50 active:bg-stone-50 transition-colors text-left"
            >
              <div className="relative shrink-0">
                {record.photos.length > 0 ? (
                  <img
                    src={record.photos[0].url}
                    alt={record.title}
                    className="w-17 h-17 object-cover rounded-xl"
                  />
                ) : (
                  <div className="w-17 h-17 bg-stone-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-stone-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm shadow-orange-200">
                  {idx + 1}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-900 truncate text-[15px]">
                  {record.title || record.location.name}
                </p>
                <p className="text-sm text-stone-400 truncate mt-0.5">{record.location.name}</p>
                {record.description && (
                  <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                    {record.description}
                  </p>
                )}
                {record.photos.length > 0 && (
                  <p className="text-xs text-stone-400 mt-1">사진 {record.photos.length}장</p>
                )}
              </div>
              <svg className="w-4 h-4 text-stone-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ))}
        </div>
      </main>

      {/* FAB (내 여행일 때만) */}
      {isOwner && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-6 right-4 w-14 h-14 bg-linear-to-br from-orange-500 to-amber-400 text-white rounded-2xl shadow-xl shadow-orange-300/50 flex items-center justify-center active:scale-95 transition-all z-30"
          aria-label="기록 추가"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  )
}
