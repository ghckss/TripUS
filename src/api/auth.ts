import { User } from '@/types'

export async function loginWithProvider(provider: 'kakao' | 'google'): Promise<User> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  })
  const { user } = await res.json()
  return user
}

export async function logoutApi(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

export async function getMe(): Promise<User | null> {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  const { user } = await res.json()
  return user
}
