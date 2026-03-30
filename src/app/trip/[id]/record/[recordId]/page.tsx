'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTripById } from '@/api/trips'
import { useTravel } from '@/store/travelStore'
import { updateRecordApi, deleteRecordApi } from '@/api/my'
import { AppHeader } from '@/components/AppHeader'
import { TravelRecordForm } from '@/components/TravelRecordForm'
import { TravelRecord } from '@/types'

export default function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>
}) {
  const { id, recordId } = use(params)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { currentUser } = useTravel()
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => fetchTripById(id),
  })

  const isOwner = !!currentUser && trip?.userId === currentUser.id

  const handleEditSubmit = async (recordData: Omit<TravelRecord, 'id'>) => {
    await updateRecordApi(id, { id: recordId, ...recordData })
    queryClient.invalidateQueries({ queryKey: ['trip', id] })
    setEditOpen(false)
  }

  const handleDelete = async () => {
    if (!confirm('이 기록을 삭제할까요?')) return
    setIsDeleting(true)
    try {
      await deleteRecordApi(id, recordId)
      queryClient.invalidateQueries({ queryKey: ['trip', id] })
      router.back()
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <AppHeader />
        <div className="max-w-lg mx-auto px-4 pt-8 space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
              <div className="h-5 bg-stone-100 rounded-lg w-1/2 mb-2" />
              <div className="h-3 bg-stone-100 rounded-lg w-1/3" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const record = trip?.records.find(r => r.id === recordId)

  if (!trip || !record) {
    return (
      <div className="min-h-dvh bg-stone-50">
        <AppHeader />
        <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)]">
          <p className="text-stone-500">기록을 찾을 수 없어요</p>
          <button onClick={() => router.back()} className="mt-4 text-orange-500 font-medium text-sm">
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  const dateLabel = new Date(record.timestamp).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="min-h-dvh bg-stone-100">
      <AppHeader />

      <main className="max-w-lg mx-auto bg-stone-100 pb-16">
        {/* 헤더 */}
        <div className="bg-white px-4 pt-4 pb-5">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1 text-orange-500 font-medium text-sm active:opacity-60 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              돌아가기
            </button>
            {isOwner && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditOpen(true)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 active:bg-stone-100 transition-colors"
                  aria-label="수정"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-red-400 active:bg-red-50 transition-colors disabled:opacity-40"
                  aria-label="삭제"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          <h1 className="font-bold text-stone-900 text-lg leading-tight">
            {record.title || record.location.name}
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">{record.location.name}</p>
          <p className="text-xs text-stone-400 mt-1">{dateLabel}</p>
        </div>

        <div className="h-2.5 bg-stone-100" />

        {/* 사진 그리드 */}
        {record.photos.length > 0 && (
          <div className="bg-white">
            <div className="px-4 py-3.5 border-b border-stone-50">
              <h3 className="font-semibold text-stone-900 text-sm">
                사진 <span className="text-stone-400 font-normal">{record.photos.length}장</span>
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-0.5 p-0.5">
              {record.photos.map((photo, idx) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxIndex(idx)}
                  className="aspect-square overflow-hidden active:opacity-80 transition-opacity"
                >
                  <img
                    src={photo.url}
                    alt={`사진 ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {record.photos.length === 0 && (
          <>
            <div className="h-2.5 bg-stone-100" />
            <div className="bg-white px-4 py-10 text-center">
              <svg className="w-10 h-10 text-stone-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-stone-400 text-sm">사진이 없어요</p>
            </div>
          </>
        )}

        {/* 메모 */}
        {record.description && (
          <>
            <div className="h-2.5 bg-stone-100" />
            <div className="bg-white">
              <div className="px-4 py-3.5 border-b border-stone-50">
                <h3 className="font-semibold text-stone-900 text-sm">메모</h3>
              </div>
              <p className="px-4 py-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
                {record.description}
              </p>
            </div>
          </>
        )}
      </main>

      {/* 수정 모달 */}
      {editOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          <TravelRecordForm
            tripId={id}
            initialRecord={record}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditOpen(false)}
          />
        </div>
      )}

      {/* 라이트박스 */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center text-white active:opacity-60"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex - 1) }}
              className="absolute left-3 w-10 h-10 flex items-center justify-center text-white active:opacity-60"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}

          <img
            src={record.photos[lightboxIndex].url}
            alt={`사진 ${lightboxIndex + 1}`}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {lightboxIndex < record.photos.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(lightboxIndex + 1) }}
              className="absolute right-3 w-10 h-10 flex items-center justify-center text-white active:opacity-60"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}

          <div className="absolute bottom-6 left-0 right-0 text-center text-white/60 text-sm">
            {lightboxIndex + 1} / {record.photos.length}
          </div>
        </div>
      )}
    </div>
  )
}
