'use client'

import { useRouter } from 'next/navigation'
import { TravelRecord } from '@/types'

interface Props {
  records: TravelRecord[]
  isOwner: boolean
  onAddFirst: () => void
  tripId: string
}

interface DayGroup {
  dayNum: number
  dateKey: string
  dateLabel: string
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
        records: [record],
      })
    } else {
      groups[groups.length - 1].records.push(record)
    }
  }

  return groups
}

export function TripRecordList({ records, isOwner, onAddFirst, tripId }: Props) {
  const router = useRouter()
  const groups = groupByDay(records)

  return (
    <div className="bg-white">
      <div className="px-4 py-3.5 border-b border-stone-50">
        <h3 className="font-semibold text-stone-900 text-sm">
          기록 <span className="text-stone-400 font-normal">{records.length}</span>
        </h3>
      </div>

      {records.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-stone-400 text-sm">아직 기록이 없어요</p>
          {isOwner && (
            <button
              onClick={onAddFirst}
              className="mt-3 text-orange-500 text-sm font-semibold"
            >
              첫 기록 추가하기
            </button>
          )}
        </div>
      ) : (
        groups.map(({ dayNum, dateKey, dateLabel, records: dayRecords }) => (
          <div key={dateKey}>
            {/* Day N 헤더 — 클릭하면 Day 상세 페이지로 이동 */}
            <button
              onClick={() => router.push(`/trip/${tripId}/day/${dayNum}`)}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-100 active:bg-stone-100 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-white bg-orange-500 rounded-full px-2.5 py-0.5">
                  Day {dayNum}
                </span>
                <span className="text-xs text-stone-500">{dateLabel}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-stone-400">
                <span>{dayRecords.length}개 장소</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* 해당 날짜의 기록들 */}
            {dayRecords.map((record, idxInDay) => (
              <div
                key={record.id}
                className="flex items-center gap-3.5 px-4 py-3.5 border-b border-stone-50"
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
                    {idxInDay + 1}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-stone-900 truncate text-[15px]">
                    {record.title || record.location.name}
                  </p>
                  <p className="text-sm text-stone-400 truncate mt-0.5">{record.location.name}</p>
                  {record.photos.length > 0 && (
                    <p className="text-xs text-stone-400 mt-1">사진 {record.photos.length}장</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
