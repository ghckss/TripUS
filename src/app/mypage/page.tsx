'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTravel } from '@/store/travelStore'
import { fetchMyTrips, createTripApi } from '@/api/my'
import { AppHeader } from '@/components/AppHeader'
import { TripRecordModal } from '@/components/TripRecordModal'
import { MyPageProfile } from '@/app/mypage/components/MyPageProfile'
import { MyPageTripList } from '@/app/mypage/components/MyPageTripList'
import { NewTripModal } from '@/app/mypage/components/NewTripModal'

export default function MyPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentUser } = useTravel()
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  const [newTripName, setNewTripName] = useState('')
  const [recordModal, setRecordModal] = useState<{ tripId: string } | null>(null)

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login')
    }
  }, [currentUser, router])

  const { data: myTrips = [] } = useQuery({
    queryKey: ['my-trips'],
    queryFn: fetchMyTrips,
    enabled: !!currentUser,
  })

  const createTripMutation = useMutation({
    mutationFn: (name: string) => createTripApi(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-trips'] }),
  })

  if (!currentUser) return null

  const totalPhotos = myTrips.reduce((sum, t) => sum + t.records.reduce((s, r) => s + r.photos.length, 0), 0)
  const totalPlaces = myTrips.reduce((sum, t) => sum + t.records.length, 0)

  const handleConfirmNewTrip = () => {
    if (!newTripName.trim()) return
    createTripMutation.mutate(newTripName.trim())
    setNewTripName('')
    setShowNewTripModal(false)
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />

      {showNewTripModal && (
        <NewTripModal
          name={newTripName}
          onChange={setNewTripName}
          onConfirm={handleConfirmNewTrip}
          onClose={() => setShowNewTripModal(false)}
        />
      )}

      {recordModal && (
        <TripRecordModal
          isOpen
          tripId={recordModal.tripId}
          onClose={() => setRecordModal(null)}
        />
      )}

      <main className="max-w-lg mx-auto pb-28">
        <MyPageProfile
          currentUser={currentUser}
          myTrips={myTrips}
          totalPhotos={totalPhotos}
          totalPlaces={totalPlaces}
        />
        <MyPageTripList
          trips={myTrips}
          onAddRecord={(tripId) => setRecordModal({ tripId })}
        />
      </main>

      {/* FAB */}
      <button
        onClick={() => { setNewTripName('새로운 여행'); setShowNewTripModal(true) }}
        className="fixed bottom-6 right-4 w-14 h-14 bg-linear-to-br from-orange-500 to-amber-400 text-white rounded-2xl shadow-xl shadow-orange-300/50 flex items-center justify-center active:scale-95 transition-all z-30"
        aria-label="새 여행 시작"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}
