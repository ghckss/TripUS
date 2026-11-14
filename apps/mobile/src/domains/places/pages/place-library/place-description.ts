const internalReasonPattern = /(?:보관함|저장한 장소|저장합니다|일정 보완|일정상|이번 일정|일정에서 제외|일정에는 제외|동선상|시간상|공간 부족|장소 교체 필요)/u;

export function placeDescription(note?: string | null): string {
  const description = note
    ?.replace(/^AI 추천\s*·\s*/u, "")
    .replace(/^보관함\s*·\s*/u, "")
    .trim();

  if (!description || internalReasonPattern.test(description)) return "";
  return description;
}
