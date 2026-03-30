import { AppHeader } from '@/components/AppHeader'
import { HomeBanner } from '@/app/home/components/HomeBanner'
import { HomeSearch } from '@/app/home/components/HomeSearch'
import { HomeTripList } from '@/app/home/components/HomeTripList'

export default function HomePage() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <HomeBanner />
      <HomeSearch />
      <HomeTripList />
    </div>
  )
}
