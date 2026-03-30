'use client'

import { useState, useRef, useEffect } from 'react'
import { LocationSearch } from './LocationSearch'
import { PhotoCapture } from './PhotoCapture'
import { TravelRecord, Photo, LocationSearchResult } from '@/types'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'

interface LocationPreviewMapProps {
  location: { lat: number; lng: number; name: string }
}

function LocationPreviewMap({ location }: LocationPreviewMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const { maps, loading } = useGoogleMaps()
  const { lat, lng } = location

  useEffect(() => {
    if (!maps || !mapRef.current) return

    const center = { lat, lng }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new maps.Map(mapRef.current, {
        zoom: 15,
        center,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: false,
        gestureHandling: 'none',
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ],
      })
    } else {
      mapInstanceRef.current.setCenter(center)
    }

    if (markerRef.current) markerRef.current.setMap(null)
    markerRef.current = new maps.Marker({
      position: center,
      map: mapInstanceRef.current,
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#F97316',
        fillOpacity: 1,
        strokeColor: '#EA580C',
        strokeWeight: 2,
      },
    })
  }, [maps, lat, lng])

  if (loading) return <div className="h-40 bg-stone-100 animate-pulse rounded-2xl mt-3" />

  return <div ref={mapRef} className="h-40 rounded-2xl overflow-hidden mt-3" />
}

interface LocationPickerMapProps {
  onLocationPick: (location: LocationSearchResult) => void
  initialCenter?: { lat: number; lng: number }
}

function LocationPickerMap({ onLocationPick, initialCenter }: LocationPickerMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const clickListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const { maps, loading } = useGoogleMaps()

  useEffect(() => {
    if (!maps || !mapRef.current) return

    const center = initialCenter ?? { lat: 37.5665, lng: 126.9780 }

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new maps.Map(mapRef.current, {
        zoom: 14,
        center,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        zoomControl: true,
        styles: [
          { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }
        ],
      })
    }

    if (clickListenerRef.current) {
      maps.event.removeListener(clickListenerRef.current)
    }

    clickListenerRef.current = mapInstanceRef.current.addListener(
      'click',
      async (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !mapInstanceRef.current) return

        if (markerRef.current) markerRef.current.setMap(null)
        markerRef.current = new maps.Marker({
          position: e.latLng,
          map: mapInstanceRef.current,
          icon: {
            path: maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#F97316',
            fillOpacity: 1,
            strokeColor: '#EA580C',
            strokeWeight: 2,
          },
          animation: maps.Animation.DROP,
        })

        try {
          const geocoder = new maps.Geocoder()
          const result = await geocoder.geocode({ location: e.latLng })
          const place = result.results[0]
          if (!place) return

          const name =
            place.address_components?.find(c => c.types.includes('sublocality_level_1'))?.long_name
            ?? place.address_components?.[0]?.long_name
            ?? place.formatted_address

          onLocationPick({
            placeId: place.place_id,
            name,
            address: place.formatted_address,
            location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
          })
        } catch {
          // geocoding 실패 시 마커만 제거
          if (markerRef.current) markerRef.current.setMap(null)
        }
      }
    )

    return () => {
      if (clickListenerRef.current) {
        maps.event.removeListener(clickListenerRef.current)
        clickListenerRef.current = null
      }
      if (markerRef.current) {
        markerRef.current.setMap(null)
        markerRef.current = null
      }
    }
  }, [maps])

  if (loading) return <div className="h-64 bg-stone-100 animate-pulse rounded-2xl" />

  return (
    <div className="relative h-64 rounded-2xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-1.5 text-xs text-white font-medium pointer-events-none whitespace-nowrap">
        지도를 탭해서 위치 선택
      </div>
    </div>
  )
}

interface TravelRecordFormProps {
  onSubmit: (record: Omit<TravelRecord, 'id'>) => void | Promise<void>
  tripId: string
  onCancel?: () => void
  initialLocation?: LocationSearchResult | null
  initialDate?: string  // yyyy-MM-dd
  initialRecord?: TravelRecord  // 편집 모드
}

function dateStrFromTimestamp(ts: number) {
  return new Date(ts).toISOString().slice(0, 10)
}

export function TravelRecordForm({ onSubmit, tripId, onCancel, initialLocation, initialDate, initialRecord }: TravelRecordFormProps) {
  const isEditMode = !!initialRecord
  const todayStr = new Date().toISOString().slice(0, 10) // yyyy-MM-dd

  const [title, setTitle] = useState(initialRecord?.title ?? '')
  const [description, setDescription] = useState(initialRecord?.description ?? '')
  const [recordDate, setRecordDate] = useState(
    initialRecord ? dateStrFromTimestamp(initialRecord.timestamp) : (initialDate ?? todayStr)
  )
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(
    initialRecord
      ? {
          placeId: '',
          name: initialRecord.location.name,
          address: initialRecord.location.name,
          location: { lat: initialRecord.location.lat, lng: initialRecord.location.lng },
        }
      : null
  )
  const [photos, setPhotos] = useState<Photo[]>(initialRecord?.photos ?? [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locationInputMode, setLocationInputMode] = useState<'search' | 'map'>('search')

  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation)
      setLocationInputMode('search')
    }
  }, [initialLocation])

  const handlePhotoCapture = (photo: Photo) => {
    setPhotos(prev => [...prev, photo])
  }

  const handleRemovePhoto = (photoId: string) => {
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocation) { alert('위치를 선택해주세요.'); return }

    // 선택한 날짜의 정오(12:00) 기준 timestamp
    const timestamp = new Date(recordDate + 'T12:00:00').getTime()

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        location: {
          lat: selectedLocation.location.lat,
          lng: selectedLocation.location.lng,
          name: selectedLocation.name,
        },
        photos,
        tripId,
        timestamp,
      })
    } catch (error) {
      console.error('Submit error:', error)
      alert('기록 저장 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white">

      {/* ── 상단 고정 바 ── */}
      <div className="flex-shrink-0 flex items-center justify-between h-14 px-4 border-b border-stone-100 bg-white">
        {onCancel ? (
          <button
            type="button"
            tabIndex={-1}
            onClick={onCancel}
            className="flex items-center gap-1 text-orange-500 font-medium text-[15px] active:opacity-60 transition-opacity"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            취소
          </button>
        ) : (
          <div className="w-14" />
        )}
        <h2 className="font-semibold text-stone-900">{isEditMode ? '기록 수정' : '새 기록'}</h2>
        <div className="w-14" />
      </div>

      {/* ── 스크롤 영역 ── */}
      <div className="flex-1 overflow-y-auto">
        <form id="travel-record-form" onSubmit={handleSubmit}>

          {/* 제목 */}
          <div className="px-4 py-5 border-b border-stone-50">
            <label htmlFor="title" className="block text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-2">
              제목
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 경복궁 나들이"
              className="w-full text-xl font-medium text-stone-900 placeholder-stone-300 border-0 focus:outline-none bg-transparent"
              autoFocus
            />
          </div>

          {/* 날짜 */}
          <div className="px-4 py-5 border-b border-stone-50">
            <label htmlFor="record-date" className="block text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-2">
              날짜
            </label>
            <input
              type="date"
              id="record-date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="text-[15px] font-medium text-stone-900 border-0 focus:outline-none bg-transparent"
            />
          </div>

          {/* 위치 */}
          <div className="px-4 py-5 border-b border-stone-50">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">
                위치 <span className="text-orange-400 normal-case tracking-normal text-xs">필수</span>
              </label>
              {/* 검색 / 지도 탭 토글 */}
              <div className="flex bg-stone-100 rounded-xl p-0.5 gap-0.5">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setLocationInputMode('search')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    locationInputMode === 'search'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-400'
                  }`}
                >
                  검색
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setLocationInputMode('map')}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                    locationInputMode === 'map'
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-400'
                  }`}
                >
                  지도
                </button>
              </div>
            </div>

            {/* 검색 모드 */}
            {locationInputMode === 'search' && (
              <LocationSearch
                onLocationSelect={(loc) => {
                  setSelectedLocation(loc)
                }}
                placeholder="장소를 검색하세요"
              />
            )}

            {/* 지도 피커 모드 */}
            {locationInputMode === 'map' && (
              <LocationPickerMap
                onLocationPick={(loc) => {
                  setSelectedLocation(loc)
                  setLocationInputMode('search')
                }}
                initialCenter={selectedLocation
                  ? { lat: selectedLocation.location.lat, lng: selectedLocation.location.lng }
                  : undefined
                }
              />
            )}

            {/* 선택된 위치 배지 */}
            {selectedLocation && (
              <>
              <LocationPreviewMap location={{ lat: selectedLocation.location.lat, lng: selectedLocation.location.lng, name: selectedLocation.name }} />
              <div className="mt-3 flex items-center gap-3 p-3.5 bg-emerald-50 rounded-2xl border border-emerald-100">
                <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="text-white" fill="currentColor" viewBox="0 0 24 24" style={{ width: 18, height: 18 }}>
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-900 text-sm">{selectedLocation.name}</p>
                  <p className="text-xs text-emerald-500 truncate mt-0.5">{selectedLocation.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLocation(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-400 active:bg-emerald-100 transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              </>
            )}
          </div>

          {/* 사진 */}
          <div className="px-4 py-5 border-b border-stone-50">
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
              사진
            </label>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square">
                    <img
                      src={photo.url}
                      alt="여행 사진"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    {/* 모바일은 hover 없으므로 항상 표시 */}
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    {photo.location && (
                      <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md font-medium">
                        GPS
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <PhotoCapture onPhotoCapture={handlePhotoCapture} disabled={isSubmitting} />
          </div>

          {/* 기록 */}
          <div className="px-4 py-5">
            <label htmlFor="description" className="block text-[11px] font-semibold text-stone-400 uppercase tracking-widest mb-2">
              기록
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이곳에서의 경험이나 느낀 점을 자유롭게 적어보세요"
              rows={5}
              className="w-full text-stone-900 placeholder-stone-300 text-[15px] leading-relaxed border-0 focus:outline-none bg-transparent resize-none"
            />
          </div>

        </form>
      </div>

      {/* ── 하단 고정 버튼 ── */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-stone-100 bg-white">
        <button
          form="travel-record-form"
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-orange-500 to-amber-400 text-white py-4 rounded-2xl font-semibold text-[15px] active:opacity-90 transition-opacity disabled:opacity-40 shadow-sm shadow-orange-200"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white inline-block" />
              저장 중...
            </span>
          ) : (
            isEditMode ? '수정 완료' : '기록 저장'
          )}
        </button>
      </div>

    </div>
  )
}
