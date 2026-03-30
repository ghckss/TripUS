import { NextRequest, NextResponse } from 'next/server'
import { db, trips, records, photos, getSession } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import type { TravelRecord, Photo } from '@/types'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId } = await params

  // 본인 여행 확인
  const [tripRow] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
  if (!tripRow) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const body = await request.json()
  const recordId = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const timestamp: number = body.timestamp ?? Date.now()

  await db.insert(records).values({
    id: recordId,
    tripId,
    title: body.title ?? '',
    description: body.description ?? '',
    locLat: body.location?.lat ?? 0,
    locLng: body.location?.lng ?? 0,
    locName: body.location?.name ?? '',
    timestamp,
  })

  const photoList: Photo[] = body.photos ?? []
  if (photoList.length > 0) {
    await db.insert(photos).values(
      photoList.map(p => ({
        id: p.id,
        recordId,
        url: p.url,
        locLat: p.location?.lat ?? null,
        locLng: p.location?.lng ?? null,
        timestamp: p.timestamp,
      }))
    )
  }

  const record: TravelRecord = {
    id: recordId,
    tripId,
    title: body.title ?? '',
    description: body.description ?? '',
    location: body.location,
    photos: photoList,
    timestamp,
  }

  return NextResponse.json(record, { status: 201 })
}
