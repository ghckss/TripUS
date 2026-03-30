import { NextRequest, NextResponse } from 'next/server'
import { db, trips, getSession, queryTripsWithRecords } from '@/lib/db'
import { eq } from 'drizzle-orm'
import type { Trip } from '@/types'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await db.select({ id: trips.id }).from(trips).where(eq(trips.userId, userId))
  const myTrips = await queryTripsWithRecords(rows.map(r => r.id))
  return NextResponse.json(myTrips)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const id = `trip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const startDate = Date.now()
  await db.insert(trips).values({ id, userId, name: name.trim(), startDate, isPublic: false })

  const trip: Trip = { id, userId, name: name.trim(), startDate, records: [] }
  return NextResponse.json(trip, { status: 201 })
}
