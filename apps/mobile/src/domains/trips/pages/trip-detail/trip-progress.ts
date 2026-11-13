export type TripProgress = {
  phase: "before" | "countdown" | "during" | "after";
  badgeLabel: string;
  heading: string;
  message: string | null;
};

export function resolveTripProgress(
  startDate: string,
  endDate: string,
  timezone: string,
  now = new Date(),
): TripProgress {
  const today = dateInTimezone(now, timezone);
  const daysUntilStart = dayNumber(startDate) - dayNumber(today);

  if (daysUntilStart > 5) {
    return { phase: "before", badgeLabel: "여행 예정", heading: "준비가 한창이에요", message: null };
  }
  if (daysUntilStart > 0) {
    return {
      phase: "countdown",
      badgeLabel: `D-${daysUntilStart}`,
      heading: `출발까지 ${daysUntilStart}일 남았어요!`,
      message: "여행 준비는 잘 되고 있나요?",
    };
  }
  if (today <= endDate) {
    return { phase: "during", badgeLabel: "여행 중", heading: "지금 여행을 즐기고 계신가요?", message: null };
  }
  return {
    phase: "after",
    badgeLabel: "여행 완료",
    heading: "여행은 즐거우셨나요?",
    message: "여행의 순간을 정리해 보세요",
  };
}

function dateInTimezone(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
    return `${value("year")}-${value("month")}-${value("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / 86_400_000;
}
