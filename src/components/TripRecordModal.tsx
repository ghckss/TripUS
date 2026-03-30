'use client'

import { useQueryClient } from '@tanstack/react-query'
import { TravelRecordForm } from './TravelRecordForm'
import { TravelRecord, LocationSearchResult } from '@/types'
import { addRecordApi } from '@/api/my'

interface TripRecordModalProps {
  isOpen: boolean
  tripId: string
  onClose: () => void
  initialLocation?: LocationSearchResult | null
  initialDate?: string  // yyyy-MM-dd
}

export function TripRecordModal({ isOpen, tripId, onClose, initialLocation, initialDate }: TripRecordModalProps) {
  const queryClient = useQueryClient()

  if (!isOpen) return null

  const handleSubmit = async (recordData: Omit<TravelRecord, 'id'>) => {
    await addRecordApi(tripId, recordData)
    queryClient.invalidateQueries({ queryKey: ['my-trips'] })
    queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <TravelRecordForm
        tripId={tripId}
        onSubmit={handleSubmit}
        onCancel={onClose}
        initialLocation={initialLocation ?? null}
        initialDate={initialDate}
      />
    </div>
  )
}
