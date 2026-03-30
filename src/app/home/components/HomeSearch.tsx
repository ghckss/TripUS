'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function HomeSearch() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput.trim()) {
      router.push(`/trips?search=${encodeURIComponent(searchInput.trim())}`)
    } else {
      router.push('/trips')
    }
  }

  return (
    <section className="relative z-10 max-w-lg mx-auto px-4 -mt-5">
      <form onSubmit={handleSearch}>
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg shadow-stone-200/60 px-4 py-3.5">
          <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="여행지, 도시, 나라 검색..."
            className="flex-1 text-sm text-stone-900 placeholder-stone-400 focus:outline-none bg-transparent"
          />
          {searchInput && (
            <button
              type="submit"
              className="text-xs font-semibold text-orange-500 px-2 py-1 rounded-lg active:bg-orange-50"
            >
              검색
            </button>
          )}
        </div>
      </form>
    </section>
  )
}
