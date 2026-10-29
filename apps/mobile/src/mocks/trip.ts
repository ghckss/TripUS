export const mockTrip = { id: "seoul-autumn", title: "서울 가을 여행", destination: "서울", dates: "10월 31일 – 11월 2일", travelers: 2 };
export const mockPlaces = [
  { id: "place-1", name: "서촌 골목", category: "산책", note: "오후 햇살이 좋을 때" },
  { id: "place-2", name: "국립현대미술관 서울", category: "전시", note: "금요일 야간 개장" },
  { id: "place-3", name: "광장시장", category: "음식", note: "저녁 식사 후보" },
];
export const mockDays = [
  { date: "10월 31일", places: ["서촌 골목", "국립현대미술관 서울"] },
  { date: "11월 1일", places: ["광장시장"] }, { date: "11월 2일", places: [] },
];
