import Link from 'next/link'

export function HomeBanner() {
  return (
    <section className="relative bg-linear-to-br from-orange-500 via-orange-400 to-amber-400 px-6 pt-10 pb-14 overflow-hidden">
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-white/10 rounded-full pointer-events-none" />

      <div className="relative max-w-lg mx-auto">
        <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-3 py-1 mb-4">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-[10px] font-semibold text-white/90 uppercase tracking-widest">여행 기록 플랫폼</span>
        </div>
        <h1 className="text-[28px] font-bold text-white leading-tight mb-2">
          모든 여행의 순간을<br />기록하세요
        </h1>
        <p className="text-orange-100 text-sm leading-relaxed">
          내 여행을 지도에 기록하고<br />다른 여행자들의 이야기를 만나보세요
        </p>
        <Link
          href="/mypage"
          className="inline-flex items-center gap-1.5 mt-5 bg-white text-orange-500 font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md active:opacity-80 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          여행 시작하기
        </Link>
      </div>
    </section>
  )
}
