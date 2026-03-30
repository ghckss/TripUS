import { NextRequest, NextResponse } from 'next/server'
import { db, users, sessions } from '@/lib/db'
import type { User } from '@/types'

// 소셜 로그인 mock 유저 (실제 OAuth 연동 시 교체)
const MOCK_USERS: Record<string, User> = {
  kakao: { id: 'user-1', name: '홍길동' },
  google: { id: 'user-1', name: '홍길동' },
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const provider = body.provider as string
  const user = MOCK_USERS[provider] ?? MOCK_USERS.kakao

  // Upsert user
  await db
    .insert(users)
    .values(user)
    .onConflictDoUpdate({ target: users.id, set: { name: user.name } })

  // Create session (7일)
  const token = crypto.randomUUID()
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000
  await db.insert(sessions).values({ token, userId: user.id, expiresAt })

  const response = NextResponse.json({ user })
  response.cookies.set('session_token', token, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
  })

  return response
}
