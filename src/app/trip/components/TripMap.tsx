'use client'

import { TravelMap } from '@/components/TravelMap'
import { TravelRecord, LocationSearchResult } from '@/types'

interface Props {
  records: TravelRecord[]
  isOwner: boolean
  onMapClick?: (location: LocationSearchResult) => void
}

export function TripMap({ records, isOwner, onMapClick }: Props) {
  return (
    <div className="bg-white">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">여행 경로</h3>
        <span className="text-[11px] text-stone-400">{records.length}개 지점</span>
      </div>
      <TravelMap
        records={records}
        onRecordClick={() => {}}
        onMapClick={isOwner ? onMapClick : undefined}
        showRoute={records.length > 0}
        className="w-full h-64 sm:h-80"
      />
    </div>
  )
}
