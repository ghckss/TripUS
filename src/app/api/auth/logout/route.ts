import { NextRequest, NextResponse } from 'next/server'
import { db, sessions } from '@/lib/db'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  if (token) await db.delete(sessions).where(eq(sessions.token, token))

  const response = NextResponse.json({ ok: true })
  response.cookies.delete('session_token')
  return response
}
