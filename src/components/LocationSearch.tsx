'use client'

import { useState, useRef, useEffect } from 'react'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { LocationSearchResult } from '@/types'

interface LocationSearchProps {
  onLocationSelect: (location: LocationSearchResult) => void
  placeholder?: string
}

export function LocationSearch({ onLocationSelect, placeholder = "장소를 검색하세요" }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const { maps, loading, error } = useGoogleMaps()
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null)

  // 세션 토큰 초기화 (Google Maps 과금 최적화)
  useEffect(() => {
    if (maps) {
      sessionTokenRef.current = new maps.places.AutocompleteSessionToken()
    }
  }, [maps])

  const searchPlaces = async (input: string) => {
    if (!maps || input.length < 2) {
      setSuggestions([])
      return
    }

    setIsSearching(true)
    try {
      const { suggestions: results } = await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input,
        sessionToken: sessionTokenRef.current ?? undefined
      })
      setSuggestions(results.slice(0, 5))
    } catch (err) {
      console.error('Places search error:', err)
      setSuggestions([])
    } finally {
      setIsSearching(false)
    }
  }

  const handleSuggestionClick = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    const prediction = suggestion.placePrediction
    if (!prediction) return

    try {
      const place = prediction.toPlace()
      await place.fetchFields({ fields: ['displayName', 'location', 'formattedAddress'] })

      if (!place.location) return

      onLocationSelect({
        placeId: prediction.placeId,
        name: place.displayName ?? prediction.mainText?.text ?? '',
        address: place.formattedAddress ?? prediction.text?.text ?? '',
        location: {
          lat: place.location.lat(),
          lng: place.location.lng(),
        },
      })

      setQuery(place.displayName ?? '')
      setIsOpen(false)
      setSuggestions([])

      // 선택 후 세션 토큰 리셋
      if (maps) {
        sessionTokenRef.current = new maps.places.AutocompleteSessionToken()
      }
    } catch (err) {
      console.error('Place details error:', err)
    }
  }

  if (loading) return <div className="animate-pulse bg-stone-100 h-11 rounded-xl" />
  if (error) return (
    <div className="text-rose-500 text-sm p-3 bg-rose-50 rounded-xl border border-rose-100">
      지도 로딩 오류: {error}
    </div>
  )

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
          {isSearching ? (
            <div className="w-4 h-4 border-2 border-stone-300 border-t-orange-400 rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          )}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            searchPlaces(e.target.value)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 text-stone-900 text-sm bg-stone-50 border border-stone-200 rounded-xl placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1.5 bg-white border border-stone-100 rounded-2xl shadow-lg overflow-hidden">
          {suggestions.map((s, i) => {
            const name = s.placePrediction?.mainText?.text ?? ''
            const address = s.placePrediction?.secondaryText?.text ?? s.placePrediction?.text?.text ?? ''
            const key = s.placePrediction?.placeId ?? i.toString()

            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSuggestionClick(s)}
                className={`w-full px-4 py-3 text-left active:bg-stone-50 transition-colors ${i < suggestions.length - 1 ? 'border-b border-stone-50' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="text-orange-400" fill="currentColor" viewBox="0 0 24 24" style={{ width: 14, height: 14 }}>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{name}</p>
                    <p className="text-xs text-stone-400 truncate mt-0.5">{address}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {isOpen && query.length >= 2 && !isSearching && suggestions.length === 0 && (
        <div className="absolute z-20 w-full mt-1.5 bg-white border border-stone-100 rounded-2xl shadow-lg">
          <div className="px-4 py-4 text-sm text-stone-400 text-center">검색 결과가 없습니다</div>
        </div>
      )}
    </div>
  )
}
