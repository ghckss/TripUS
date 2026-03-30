'use client'

interface Props {
  value: string
  onChange: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onClear: () => void
}

export function TripsSearch({ value, onChange, onSubmit, onClear }: Props) {
  return (
    <form onSubmit={onSubmit} className="mb-5">
      <div className="flex items-center gap-2 bg-white rounded-2xl shadow-sm shadow-stone-200/60 px-4 py-3.5 border border-stone-100">
        <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="여행지, 도시, 나라 검색..."
          className="flex-1 text-sm text-stone-900 placeholder-stone-400 focus:outline-none bg-transparent"
          autoFocus={!!value}
        />
        {value && (
          <button
            type="button"
            onClick={onClear}
            className="text-stone-400 active:text-stone-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
