'use client'

import { useEffect, useRef } from 'react'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { TravelRecord, LocationSearchResult } from '@/types'

interface TravelMapProps {
  records: TravelRecord[]
  onRecordClick?: (record: TravelRecord) => void
  onMapClick?: (location: LocationSearchResult) => void
  showRoute?: boolean
  className?: string
}

const ANIMATION_INTERVAL_MS = 300

export function TravelMap({
  records,
  onRecordClick,
  onMapClick,
  showRoute = true,
  className = "w-full h-96"
}: TravelMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const animationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const tempMarkerRef = useRef<google.maps.Marker | null>(null)
  const mapClickListenerRef = useRef<google.maps.MapsEventListener | null>(null)
  const dotPolylineRef = useRef<google.maps.Polyline | null>(null)
  const dotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { maps, loading, error } = useGoogleMaps()

  const clearAnimationTimers = () => {
    animationTimersRef.current.forEach(clearTimeout)
    animationTimersRef.current = []
  }

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []
  }

  const clearDotAnimation = () => {
    if (dotIntervalRef.current) {
      clearInterval(dotIntervalRef.current)
      dotIntervalRef.current = null
    }
    if (dotPolylineRef.current) {
      dotPolylineRef.current.setMap(null)
      dotPolylineRef.current = null
    }
  }

  const clearRoute = () => {
    clearDotAnimation()
    if (polylineRef.current) {
      polylineRef.current.setMap(null)
      polylineRef.current = null
    }
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null)
      directionsRendererRef.current = null
    }
  }

  const clearTempMarker = () => {
    if (tempMarkerRef.current) {
      tempMarkerRef.current.setMap(null)
      tempMarkerRef.current = null
    }
  }

  useEffect(() => {
    if (!maps || !mapRef.current) return

    if (!mapInstanceRef.current) {
      const defaultCenter = records.length > 0
        ? { lat: records[0].location.lat, lng: records[0].location.lng }
        : { lat: 37.5665, lng: 126.9780 }

      mapInstanceRef.current = new maps.Map(mapRef.current, {
        zoom: 12,
        center: defaultCenter,
        mapTypeControl: false,
        fullscreenControl: false,
        streetViewControl: false,
        styles: [
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }]
          }
        ]
      })

      infoWindowRef.current = new maps.InfoWindow()
    }

    // 기존 map click listener 제거 후 재등록
    if (mapClickListenerRef.current) {
      maps.event.removeListener(mapClickListenerRef.current)
      mapClickListenerRef.current = null
    }

    if (onMapClick) {
      mapClickListenerRef.current = mapInstanceRef.current.addListener(
        'click',
        async (e: google.maps.MapMouseEvent) => {
          if (!e.latLng || !mapInstanceRef.current) return

          clearTempMarker()

          tempMarkerRef.current = new maps.Marker({
            position: e.latLng,
            map: mapInstanceRef.current,
            icon: {
              path: maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#6366F1',
              fillOpacity: 0.9,
              strokeColor: '#4F46E5',
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

            onMapClick({
              placeId: place.place_id,
              name,
              address: place.formatted_address,
              location: { lat: e.latLng.lat(), lng: e.latLng.lng() },
            })
          } catch {
            clearTempMarker()
          }
        }
      )
    }

    clearAnimationTimers()
    clearMarkers()
    clearRoute()

    const sortedRecords = [...records].sort((a, b) => a.timestamp - b.timestamp)

    // 마커 생성 (처음엔 숨김)
    sortedRecords.forEach((record, index) => {
      const marker = new maps.Marker({
        position: { lat: record.location.lat, lng: record.location.lng },
        map: mapInstanceRef.current,
        title: record.title,
        visible: false,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold',
          fontSize: '12px'
        },
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 15,
          fillColor: '#F97316',
          fillOpacity: 1,
          strokeColor: '#EA580C',
          strokeWeight: 2
        }
      })

      marker.addListener('click', () => {
        showInfoWindow(marker, record)
        onRecordClick?.(record)
      })

      markersRef.current.push(marker)
    })

    // 마커 순차 등장 애니메이션
    markersRef.current.forEach((marker, i) => {
      const timer = setTimeout(() => {
        marker.setVisible(true)
      }, i * ANIMATION_INTERVAL_MS)
      animationTimersRef.current.push(timer)
    })

    // 경로 (마커 애니메이션 완료 후 시작)
    if (showRoute && sortedRecords.length >= 2) {
      const routeDelay = sortedRecords.length * ANIMATION_INTERVAL_MS + 100
      const timer = setTimeout(() => {
        updateDirectionsRoute(sortedRecords)
      }, routeDelay)
      animationTimersRef.current.push(timer)
    }

    if (records.length > 0) {
      fitMapBounds()
    }

    return () => {
      clearAnimationTimers()
      clearMarkers()
      clearRoute()        // clearDotAnimation 포함
      clearTempMarker()
      if (mapClickListenerRef.current) {
        maps.event.removeListener(mapClickListenerRef.current)
        mapClickListenerRef.current = null
      }
    }
  }, [maps, records, showRoute, onMapClick])

  const updateDirectionsRoute = (sortedRecords: TravelRecord[]) => {
    if (!mapInstanceRef.current || !maps || sortedRecords.length < 2) return

    if (sortedRecords.length > 27) {
      updatePolylineRoute(sortedRecords)
      return
    }

    const origin = { lat: sortedRecords[0].location.lat, lng: sortedRecords[0].location.lng }
    const destination = {
      lat: sortedRecords[sortedRecords.length - 1].location.lat,
      lng: sortedRecords[sortedRecords.length - 1].location.lng
    }
    const waypoints = sortedRecords.slice(1, -1).map(r => ({
      location: { lat: r.location.lat, lng: r.location.lng },
      stopover: true,
    }))

    const renderer = new maps.DirectionsRenderer({
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: {
        strokeColor: '#F97316',
        strokeOpacity: 0,
        strokeWeight: 0,
      },
    })
    renderer.setMap(mapInstanceRef.current)
    directionsRendererRef.current = renderer

    const service = new maps.DirectionsService()
    service.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === maps.DirectionsStatus.OK && result) {
          renderer.setDirections(result)
          const path = result.routes[0].overview_path
          animatePolyline(path, sortedRecords.length - 1)
        } else {
          renderer.setMap(null)
          directionsRendererRef.current = null
          updatePolylineRoute(sortedRecords)
        }
      }
    )
  }

  // 흰색 점이 경로 위를 구간당 3초 속도로 1→N 반복 이동
  const startDotAnimation = (path: google.maps.LatLng[] | Array<{ lat: number; lng: number }>, numSegments: number) => {
    if (!mapInstanceRef.current || !maps) return

    clearDotAnimation()

    // 구간당 3초 × 구간 수 = 전체 사이클 시간
    const SECS_PER_SEGMENT = 3
    const cycleDurationMs = numSegments * SECS_PER_SEGMENT * 1000
    const INTERVAL_MS = 20
    const totalSteps = cycleDurationMs / INTERVAL_MS
    const stepPercent = 100 / totalSteps  // 한 스텝당 전진할 %

    const dotLine = new maps.Polyline({
      path,
      strokeOpacity: 0,
      strokeWeight: 0,
      icons: [{
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#FFFFFF',
          fillOpacity: 0.7,
          strokeColor: '#F97316',
          strokeWeight: 2,
          strokeOpacity: 0.7,
        },
        offset: '0%',
      }],
      map: mapInstanceRef.current,
    })
    dotPolylineRef.current = dotLine

    let offset = 0
    dotIntervalRef.current = setInterval(() => {
      offset = (offset + stepPercent) % 100
      dotLine.set('icons', [{
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#FFFFFF',
          fillOpacity: 0.7,
          strokeColor: '#F97316',
          strokeWeight: 2,
          strokeOpacity: 0.7,
        },
        offset: offset.toFixed(2) + '%',
      }])
    }, INTERVAL_MS)
  }

  const animatePolyline = (path: google.maps.LatLng[], numSegments: number) => {
    if (!mapInstanceRef.current || !maps) return

    // 배경 선 (흐린 전체 경로)
    const bgLine = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#F97316',
      strokeOpacity: 0.12,
      strokeWeight: 4,
      map: mapInstanceRef.current,
    })
    polylineRef.current = bgLine

    // 전경 선 (점진적으로 그려짐)
    const fgLine = new maps.Polyline({
      path: [path[0]],
      geodesic: true,
      strokeColor: '#F97316',
      strokeOpacity: 0.75,
      strokeWeight: 4,
      map: mapInstanceRef.current,
    })

    let i = 1
    const step = () => {
      if (i >= path.length) {
        // 경로 draw 완료 → 점 애니메이션 시작
        startDotAnimation(path, numSegments)
        return
      }
      fgLine.getPath().push(path[i])
      i++
      const timer = setTimeout(step, 16)
      animationTimersRef.current.push(timer)
    }
    const timer = setTimeout(step, 0)
    animationTimersRef.current.push(timer)
  }

  const updatePolylineRoute = (sortedRecords: TravelRecord[]) => {
    if (!mapInstanceRef.current || !maps) return

    const path = sortedRecords.map(r => ({ lat: r.location.lat, lng: r.location.lng }))
    polylineRef.current = new maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#F97316',
      strokeOpacity: 0.7,
      strokeWeight: 3,
      map: mapInstanceRef.current
    })
    // fallback polyline도 점 애니메이션
    startDotAnimation(path, sortedRecords.length - 1)
  }

  const showInfoWindow = (marker: google.maps.Marker, record: TravelRecord) => {
    if (!infoWindowRef.current) return

    const photoPreview = record.photos.length > 0
      ? `<img src="${record.photos[0].url}" alt="${record.title}" style="width: 200px; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />`
      : ''

    const content = `
      <div style="max-width: 250px; padding: 8px;">
        ${photoPreview}
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: bold; color: #1F2937;">${record.title}</h3>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6B7280;">${record.location.name}</p>
        ${record.description ? `<p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.4;">${record.description.substring(0, 100)}${record.description.length > 100 ? '...' : ''}</p>` : ''}
        <div style="margin-top: 8px; font-size: 12px; color: #9CA3AF;">
          ${new Date(record.timestamp).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>
    `

    infoWindowRef.current.setContent(content)
    infoWindowRef.current.open(mapInstanceRef.current, marker)
  }

  const fitMapBounds = () => {
    if (!mapInstanceRef.current || !maps || records.length === 0) return

    if (records.length === 1) {
      mapInstanceRef.current.setCenter({
        lat: records[0].location.lat,
        lng: records[0].location.lng
      })
      mapInstanceRef.current.setZoom(15)
      return
    }

    const bounds = new maps.LatLngBounds()
    records.forEach(record => {
      bounds.extend({ lat: record.location.lat, lng: record.location.lng })
    })

    mapInstanceRef.current.fitBounds(bounds, 50)
  }

  if (loading) {
    return (
      <div className={`${className} bg-gray-200 animate-pulse rounded-lg flex items-center justify-center`}>
        <div className="text-gray-500">지도 로딩 중...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} bg-red-50 border border-red-200 rounded-lg flex items-center justify-center`}>
        <div className="text-red-600 text-center p-4">
          <div className="font-medium">지도 로딩 실패</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      </div>
    )
  }

  if (records.length === 0 && !onMapClick) {
    return (
      <div className={`${className} bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center`}>
        <div className="text-gray-500 text-center p-4">
          <div className="font-medium mb-2">아직 여행 기록이 없습니다</div>
          <div className="text-sm">첫 번째 기록을 추가해보세요!</div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${className} relative`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />

      {onMapClick && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-indigo-500/90 backdrop-blur-sm rounded-xl shadow-sm px-3 py-1.5 text-xs text-white font-medium pointer-events-none whitespace-nowrap">
          지도를 탭해서 위치 선택
        </div>
      )}

      {!onMapClick && showRoute && records.length > 1 && (
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm px-3 py-1.5 text-xs text-stone-600 font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-orange-500 rounded-full"></div>
            <span>{records.length}개 지점 연결됨</span>
          </div>
        </div>
      )}

      {!onMapClick && (
        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-sm px-3 py-1.5 text-[11px] text-stone-400">
          시간순 번호 표시
        </div>
      )}
    </div>
  )
}
