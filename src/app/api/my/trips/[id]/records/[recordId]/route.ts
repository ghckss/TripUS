import { NextRequest, NextResponse } from 'next/server'
import { db, trips, records, photos, getSession } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId, recordId } = await params

  // 본인 여행 확인
  const [tripRow] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
  if (!tripRow) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('title' in body) updates.title = body.title
  if ('description' in body) updates.description = body.description
  if ('timestamp' in body) updates.timestamp = body.timestamp
  if ('location' in body) {
    updates.locLat = body.location.lat
    updates.locLng = body.location.lng
    updates.locName = body.location.name
  }

  const [updated] = await db
    .update(records)
    .set(updates)
    .where(eq(records.id, recordId))
    .returning()
  if (!updated) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  // photos 업데이트
  if ('photos' in body && Array.isArray(body.photos)) {
    await db.delete(photos).where(eq(photos.recordId, recordId))
    if (body.photos.length > 0) {
      await db.insert(photos).values(
        body.photos.map((p: { id: string; url: string; location?: { lat: number; lng: number }; timestamp: number }) => ({
          id: p.id,
          recordId,
          url: p.url,
          locLat: p.location?.lat ?? null,
          locLng: p.location?.lng ?? null,
          timestamp: p.timestamp,
        }))
      )
    }
  }

  return NextResponse.json({
    id: updated.id,
    tripId: updated.tripId,
    title: updated.title,
    description: updated.description,
    location: { lat: updated.locLat, lng: updated.locLng, name: updated.locName },
    photos: body.photos ?? [],
    timestamp: updated.timestamp,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string }> }
) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: tripId, recordId } = await params

  // 본인 여행 확인
  const [tripRow] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), eq(trips.userId, userId)))
  if (!tripRow) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  const [deleted] = await db
    .delete(records)
    .where(eq(records.id, recordId))
    .returning({ id: records.id })
  if (!deleted) return NextResponse.json({ error: 'Record not found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
