import { AppHeader } from '@/components/AppHeader'
import { LoginForm } from '@/app/login/components/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-dvh bg-stone-50">
      <AppHeader />
      <main className="flex flex-col items-center justify-center min-h-[calc(100dvh-56px)] px-6">
        <LoginForm />
      </main>
    </div>
  )
}
