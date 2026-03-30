import { NextRequest, NextResponse } from 'next/server'
import { db, trips, getSession, queryTripWithRecords } from '@/lib/db'
import { and, eq } from 'drizzle-orm'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const [tripRow] = await db
    .select({ id: trips.id, isPublic: trips.isPublic, userId: trips.userId })
    .from(trips)
    .where(eq(trips.id, id))

  if (!tripRow) return NextResponse.json({ error: 'Trip not found' }, { status: 404 })

  // 공개 여행이면 바로 반환
  if (tripRow.isPublic) {
    return NextResponse.json(await queryTripWithRecords(id))
  }

  // 인증된 본인 여행 확인
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (userId) {
    const [own] = await db
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.id, id), eq(trips.userId, userId)))
    if (own) return NextResponse.json(await queryTripWithRecords(id))
  }

  return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
}
