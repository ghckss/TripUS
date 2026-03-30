'use client'

interface Props {
  name: string
  onChange: (name: string) => void
  onConfirm: () => void
  onClose: () => void
}

export function NewTripModal({ name, onChange, onConfirm, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="px-6 pt-7 pb-6">
          <h2 className="text-lg font-bold text-stone-900 mb-1">새 여행 시작</h2>
          <p className="text-sm text-stone-400 mb-5">여행 이름을 입력해주세요</p>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onConfirm() }}
            placeholder="예: 제주도 여행"
            className="w-full text-lg font-medium text-stone-900 placeholder-stone-300 border border-stone-200 focus:border-orange-400 focus:outline-none rounded-2xl px-4 py-3.5 transition-colors"
            autoFocus
          />
        </div>
        <div className="flex border-t border-stone-100">
          <button type="button" onClick={onClose} className="flex-1 py-4 text-[15px] font-medium text-stone-500 active:bg-stone-50">취소</button>
          <div className="w-px bg-stone-100" />
          <button type="button" onClick={onConfirm} disabled={!name.trim()} className="flex-1 py-4 text-[15px] font-semibold text-orange-500 active:bg-orange-50 disabled:text-stone-300">시작</button>
        </div>
      </div>
    </div>
  )
}
