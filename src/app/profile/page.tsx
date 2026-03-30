'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTravel } from '@/store/travelStore'
import { AppHeader } from '@/components/AppHeader'
import { ProfileForm } from '@/app/profile/components/ProfileForm'

export default function ProfilePage() {
  const router = useRouter()
  const { currentUser } = useTravel()

  useEffect(() => {
    if (!currentUser) {
      router.replace('/login')
    }
  }, [currentUser, router])

  if (!currentUser) return null

  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="max-w-lg mx-auto px-4 pt-8 pb-20">
        <h1 className="text-xl font-bold text-stone-900 mb-6">프로필 편집</h1>
        <ProfileForm currentUser={currentUser} />
      </main>
    </div>
  )
}
