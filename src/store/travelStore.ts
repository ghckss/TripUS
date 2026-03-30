import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

// 여행 데이터는 이제 서버 API 관리 → Zustand는 인증 상태만 담당
interface TravelStore {
  currentUser: User | null
  login: (user: User) => void
  logout: () => void
}

export const useTravelStore = create<TravelStore>()(
  persist(
    (set) => ({
      currentUser: null,
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
    }),
    {
      name: 'tripus-auth',
      partialize: (state) => ({ currentUser: state.currentUser }),
    }
  )
)

export const useTravel = useTravelStore
