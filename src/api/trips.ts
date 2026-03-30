import { Trip } from '@/types'

export async function fetchPublicTrips(search?: string): Promise<Trip[]> {
  const url = search?.trim()
    ? `/api/trips?search=${encodeURIComponent(search.trim())}`
    : '/api/trips'
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

export async function fetchTripById(id: string): Promise<Trip | null> {
  const res = await fetch(`/api/trips/${id}`)
  if (!res.ok) return null
  return res.json()
}
