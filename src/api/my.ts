import { Trip, TravelRecord } from '@/types'

export async function fetchMyTrips(): Promise<Trip[]> {
  const res = await fetch('/api/my/trips')
  if (!res.ok) return []
  return res.json()
}

export async function createTripApi(name: string): Promise<Trip> {
  const res = await fetch('/api/my/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return res.json()
}

export async function deleteTripApi(id: string): Promise<void> {
  await fetch(`/api/my/trips/${id}`, { method: 'DELETE' })
}

export async function addRecordApi(
  tripId: string,
  record: Omit<TravelRecord, 'id'>
): Promise<TravelRecord> {
  // File 객체는 JSON 직렬화 불가 → 제거
  const sanitized = {
    ...record,
    photos: record.photos.map(({ file: _file, ...p }) => p),
  }
  const res = await fetch(`/api/my/trips/${tripId}/records`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitized),
  })
  return res.json()
}

export async function updateRecordApi(
  tripId: string,
  record: TravelRecord
): Promise<TravelRecord> {
  const { file: _file, ...rest } = record as TravelRecord & { file?: File }
  const sanitized = { ...rest, photos: record.photos.map(({ file: _f, ...p }) => p) }
  const res = await fetch(`/api/my/trips/${tripId}/records/${record.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sanitized),
  })
  return res.json()
}

export async function deleteRecordApi(tripId: string, recordId: string): Promise<void> {
  await fetch(`/api/my/trips/${tripId}/records/${recordId}`, { method: 'DELETE' })
}
