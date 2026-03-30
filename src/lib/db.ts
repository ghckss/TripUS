import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, inArray } from 'drizzle-orm'
import { users, sessions, trips, records, photos } from './schema'
import type { Trip } from '@/types'

// ── Drizzle 클라이언트 (Next.js HMR 시 중복 연결 방지) ───────────────────────
declare global {
  // eslint-disable-next-line no-var
  var _pgClient: ReturnType<typeof postgres> | undefined
}

if (!globalThis._pgClient) {
  globalThis._pgClient = postgres(
    process.env.DATABASE_URL ?? 'postgresql://appuser:secret123@localhost:15432/appdb'
  )
}

export const db = drizzle(globalThis._pgClient, {
  schema: { users, sessions, trips, records, photos },
})
export { users, sessions, trips, records, photos }

// ── 세션 헬퍼 ────────────────────────────────────────────────────────────────
export async function getSession(token: string | undefined): Promise<string | null> {
  if (!token) return null
  const [row] = await db
    .select({ userId: sessions.userId, expiresAt: sessions.expiresAt })
    .from(sessions)
    .where(eq(sessions.token, token))
  if (!row || row.expiresAt < Date.now()) return null
  return row.userId
}

// ── Trip 조립 헬퍼 ────────────────────────────────────────────────────────────
type TripRow = typeof trips.$inferSelect
type RecordRow = typeof records.$inferSelect
type PhotoRow = typeof photos.$inferSelect

function buildTrips(
  tripRows: TripRow[],
  recordRows: RecordRow[],
  photoRows: PhotoRow[]
): Trip[] {
  const photosByRecord = new Map<string, PhotoRow[]>()
  for (const p of photoRows) {
    const arr = photosByRecord.get(p.recordId) ?? []
    arr.push(p)
    photosByRecord.set(p.recordId, arr)
  }

  const recordsByTrip = new Map<string, RecordRow[]>()
  for (const r of recordRows) {
    const arr = recordsByTrip.get(r.tripId) ?? []
    arr.push(r)
    recordsByTrip.set(r.tripId, arr)
  }

  return tripRows.map(t => ({
    id: t.id,
    userId: t.userId,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate ?? undefined,
    records: (recordsByTrip.get(t.id) ?? [])
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(r => ({
        id: r.id,
        tripId: r.tripId,
        title: r.title,
        description: r.description,
        location: { lat: r.locLat, lng: r.locLng, name: r.locName },
        photos: (photosByRecord.get(r.id) ?? []).map(p => ({
          id: p.id,
          url: p.url,
          location:
            p.locLat != null && p.locLng != null
              ? { lat: p.locLat, lng: p.locLng }
              : undefined,
          timestamp: p.timestamp,
        })),
        timestamp: r.timestamp,
      })),
  }))
}

export async function queryTripsWithRecords(tripIds: string[]): Promise<Trip[]> {
  if (tripIds.length === 0) return []
  const tripRows = await db.select().from(trips).where(inArray(trips.id, tripIds))
  if (tripRows.length === 0) return []

  const recordRows = await db.select().from(records).where(inArray(records.tripId, tripIds))
  const photoRows =
    recordRows.length > 0
      ? await db
          .select()
          .from(photos)
          .where(inArray(photos.recordId, recordRows.map(r => r.id)))
      : []

  return buildTrips(tripRows, recordRows, photoRows)
}

export async function queryTripWithRecords(id: string): Promise<Trip | null> {
  const result = await queryTripsWithRecords([id])
  return result[0] ?? null
}
