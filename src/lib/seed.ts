/**
 * DB 초기 시드 스크립트
 * 실행: npm run db:seed
 */
import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { users, sessions, trips, records, photos } from './schema'

const client = postgres(
  process.env.DATABASE_URL ?? 'postgresql://appuser:secret123@localhost:15432/appdb'
)
const db = drizzle(client)

// ── 시드 데이터 ──────────────────────────────────────────────────────────────
const SEED_USERS = [
  { id: 'user-1', name: '홍길동' },
  { id: 'user-2', name: '김여행' },
  { id: 'user-3', name: '이탐험' },
  { id: 'user-4', name: '박미식' },
  { id: 'user-5', name: '최낭만' },
  { id: 'user-6', name: '정역사' },
  { id: 'user-7', name: '강휴가' },
]

const SEED_TRIPS = [
  {
    id: 'public-1', userId: 'user-2', name: '제주도 힐링 여행',
    startDate: new Date('2025-01-10').getTime(), isPublic: true,
    records: [
      { id: 'rec-1-1', title: '성산일출봉', description: '일출을 보러 새벽 5시에 올라갔어요. 정말 장관이었습니다.', lat: 33.4581, lng: 126.9425, name: '성산일출봉', timestamp: new Date('2025-01-10T06:00:00').getTime() },
      { id: 'rec-1-2', title: '협재 해수욕장', description: '에메랄드빛 바다가 너무 예뻤어요.', lat: 33.3941, lng: 126.2397, name: '협재 해수욕장', timestamp: new Date('2025-01-11T14:00:00').getTime() },
      { id: 'rec-1-3', title: '한라산 등반', description: '정상까지 올라가서 백록담을 봤습니다.', lat: 33.3617, lng: 126.5292, name: '한라산 국립공원', timestamp: new Date('2025-01-12T08:00:00').getTime() },
    ],
  },
  {
    id: 'public-2', userId: 'user-3', name: '도쿄 3박 4일',
    startDate: new Date('2025-02-14').getTime(), isPublic: true,
    records: [
      { id: 'rec-2-1', title: '시부야 스크램블 교차로', description: '도쿄의 상징적인 장소. 사람이 정말 많았어요.', lat: 35.6595, lng: 139.7004, name: '시부야 스크램블 교차로', timestamp: new Date('2025-02-14T16:00:00').getTime() },
      { id: 'rec-2-2', title: '아사쿠사 센소지', description: '도쿄에서 가장 오래된 사원.', lat: 35.7147, lng: 139.7966, name: '센소지', timestamp: new Date('2025-02-15T10:00:00').getTime() },
      { id: 'rec-2-3', title: '도쿄 스카이트리', description: '634m 높이에서 도쿄 전경을 내려다봤습니다.', lat: 35.7101, lng: 139.8107, name: '도쿄 스카이트리', timestamp: new Date('2025-02-16T15:00:00').getTime() },
    ],
  },
  {
    id: 'public-3', userId: 'user-4', name: '부산 미식 여행',
    startDate: new Date('2025-03-01').getTime(), isPublic: true,
    records: [
      { id: 'rec-3-1', title: '광안리 해수욕장', description: '광안대교 야경과 함께하는 야식. 최고!', lat: 35.1531, lng: 129.1186, name: '광안리 해수욕장', timestamp: new Date('2025-03-01T20:00:00').getTime() },
      { id: 'rec-3-2', title: '자갈치 시장', description: '싱싱한 회를 저렴하게 먹을 수 있어요.', lat: 35.0968, lng: 129.0298, name: '자갈치 시장', timestamp: new Date('2025-03-02T12:00:00').getTime() },
    ],
  },
  {
    id: 'public-4', userId: 'user-5', name: '파리 낭만 여행',
    startDate: new Date('2024-12-20').getTime(), isPublic: true,
    records: [
      { id: 'rec-4-1', title: '에펠탑', description: '밤에 반짝이는 에펠탑은 정말 아름다워요.', lat: 48.8584, lng: 2.2945, name: '에펠탑', timestamp: new Date('2024-12-20T21:00:00').getTime() },
      { id: 'rec-4-2', title: '루브르 박물관', description: '모나리자를 직접 봤어요. 생각보다 작더라고요.', lat: 48.8606, lng: 2.3376, name: '루브르 박물관', timestamp: new Date('2024-12-21T10:00:00').getTime() },
    ],
  },
  {
    id: 'public-5', userId: 'user-6', name: '경주 역사 탐방',
    startDate: new Date('2025-04-05').getTime(), isPublic: true,
    records: [
      { id: 'rec-5-1', title: '불국사', description: '유네스코 세계문화유산. 봄 벚꽃과 함께라 더 예뻤어요.', lat: 35.7901, lng: 129.3318, name: '불국사', timestamp: new Date('2025-04-05T10:00:00').getTime() },
      { id: 'rec-5-2', title: '첨성대', description: '신라시대 천문대. 야경이 정말 예뻤습니다.', lat: 35.8349, lng: 129.2194, name: '첨성대', timestamp: new Date('2025-04-05T18:00:00').getTime() },
    ],
  },
  {
    id: 'public-6', userId: 'user-7', name: '방콕 여름 휴가',
    startDate: new Date('2025-07-01').getTime(), isPublic: true,
    records: [
      { id: 'rec-6-1', title: '왓 포 사원', description: '와불상이 인상적인 방콕의 대표 사원.', lat: 13.7465, lng: 100.4927, name: '왓 포 사원', timestamp: new Date('2025-07-01T09:00:00').getTime() },
      { id: 'rec-6-2', title: '카오산 로드', description: '배낭여행자들의 성지. 밤에 분위기가 최고예요.', lat: 13.7588, lng: 100.4977, name: '카오산 로드', timestamp: new Date('2025-07-01T21:00:00').getTime() },
    ],
  },
]

async function seed() {
  console.log('🌱 Seeding database...')

  // 순서 중요: FK 제약으로 자식 테이블 먼저 삭제
  await db.delete(photos)
  await db.delete(records)
  await db.delete(sessions)
  await db.delete(trips)
  await db.delete(users)

  // Users
  await db.insert(users).values(SEED_USERS)
  console.log(`  ✓ ${SEED_USERS.length} users`)

  // Trips + Records
  for (const t of SEED_TRIPS) {
    await db.insert(trips).values({
      id: t.id,
      userId: t.userId,
      name: t.name,
      startDate: t.startDate,
      isPublic: t.isPublic,
    })

    if (t.records.length > 0) {
      await db.insert(records).values(
        t.records.map(r => ({
          id: r.id,
          tripId: t.id,
          title: r.title,
          description: r.description,
          locLat: r.lat,
          locLng: r.lng,
          locName: r.name,
          timestamp: r.timestamp,
        }))
      )
    }
  }
  console.log(`  ✓ ${SEED_TRIPS.length} public trips`)

  console.log('✅ Seeding complete!')
  await client.end()
}

seed().catch(err => {
  console.error('Seed failed:', err)
  process.exit(1)
})
