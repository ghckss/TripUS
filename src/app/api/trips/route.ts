import { NextRequest, NextResponse } from 'next/server'
import { db, trips, queryTripsWithRecords } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase().trim()

  // 공개 여행 ID 목록 조회
  const rows = await db.select({ id: trips.id }).from(trips).where(eq(trips.isPublic, true))
  const publicTrips = await queryTripsWithRecords(rows.map(r => r.id))

  if (!search) return NextResponse.json(publicTrips)

  // 앱 레벨 검색 (trip name + record title/location)
  const filtered = publicTrips.filter(
    t =>
      t.name.toLowerCase().includes(search) ||
      t.records.some(
        r =>
          r.location.name.toLowerCase().includes(search) ||
          r.title.toLowerCase().includes(search)
      )
  )

  return NextResponse.json(filtered)
}
