'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchTripById } from '@/api/trips'
import { useTravel } from '@/store/travelStore'
import { TripRecordModal } from '@/components/TripRecordModal'
import { AppHeader } from '@/components/AppHeader'
import { TripCoverCard } from '@/app/trip/components/TripCoverCard'
import { TripRecordList } from '@/app/trip/components/TripRecordList'

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { currentUser } = useTravel()
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
          <button onClick={() => router.push('/')} className="mt-4 text-orange-500 font-medium text-sm">홈으로</button>
        </div>
      </div>
    )
  }

  const chronologicalRecords = [...trip.records].sort((a, b) => a.timestamp - b.timestamp)

  return (
    <div className="min-h-dvh bg-stone-100">
      <AppHeader />

      <TripRecordModal
        isOpen={modalOpen}
        tripId={trip.id}
        onClose={() => setModalOpen(false)}
      />

      <main className="max-w-lg mx-auto bg-stone-100 pb-28">
        <TripCoverCard trip={trip} onBack={() => router.back()} />

        <div className="h-2.5 bg-stone-100" />

        <TripRecordList
          records={chronologicalRecords}
          isOwner={isOwner}
          tripId={trip.id}
          onAddFirst={() => setModalOpen(true)}
        />
      </main>

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
