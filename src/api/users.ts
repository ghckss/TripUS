import { User } from '@/types'

export async function fetchUserById(id: string): Promise<User | null> {
  const res = await fetch(`/api/users/${id}`)
  if (!res.ok) return null
  return res.json()
}
