'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { fetchPublicTrips } from '@/api/trips'
import { AppHeader } from '@/components/AppHeader'
import { TripsSearch } from '@/app/trips/components/TripsSearch'
import { TripsList } from '@/app/trips/components/TripsList'

function TripsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSearch = searchParams.get('search') ?? ''
  const [searchInput, setSearchInput] = useState(initialSearch)

  useEffect(() => {
    setSearchInput(searchParams.get('search') ?? '')
  }, [searchParams])

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['public-trips', initialSearch],
    queryFn: () => fetchPublicTrips(initialSearch || undefined),
  })

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchInput.trim()
    router.push(q ? `/trips?search=${encodeURIComponent(q)}` : '/trips')
  }

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />

      <main className="max-w-lg mx-auto px-4 pt-5 pb-10">
        <TripsSearch
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={handleSearch}
          onClear={() => { setSearchInput(''); router.push('/trips') }}
        />

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-widest">
            {initialSearch ? `"${initialSearch}" 검색 결과` : '전체 여행'}
          </h2>
          {!isLoading && (
            <span className="text-xs text-stone-400">{trips.length}개</span>
          )}
        </div>

        <TripsList trips={trips} isLoading={isLoading} />
      </main>
    </div>
  )
}

export default function TripsPage() {
  return (
    <Suspense>
      <TripsContent />
    </Suspense>
  )
}
