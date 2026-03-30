import { NextRequest, NextResponse } from 'next/server'
import { db, trips, getSession, queryTripWithRecords } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const updates: Record<string, unknown> = {}
  if ('name' in body) updates.name = body.name
  if ('endDate' in body) updates.endDate = body.endDate

  const [updated] = await db
    .update(trips)
    .set(updates)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning({ id: trips.id })

  if (!updated) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  return NextResponse.json(await queryTripWithRecords(id))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const [deleted] = await db
    .delete(trips)
    .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    .returning({ id: trips.id })

  if (!deleted) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
