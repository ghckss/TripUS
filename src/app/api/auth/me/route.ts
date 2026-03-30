import { NextRequest, NextResponse } from 'next/server'
import { db, users, getSession } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  const userId = await getSession(token)
  if (!userId) return NextResponse.json({ user: null })

  const [user] = await db.select().from(users).where(eq(users.id, userId))
  return NextResponse.json({ user: user ?? null })
}
