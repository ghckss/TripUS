# TripUS 기술 아키텍처

## 1. 결정 요약

TripUS MVP는 모바일 우선 Next.js App Router 웹/PWA로 구축한다. TypeScript를 전 구간에 사용하고, PostgreSQL과 Drizzle ORM을 영속 계층의 기준으로 둔다. 첫 번째 구현 단계에서는 Google Maps와 AI를 결정적(deterministic) 목업 어댑터로 제공해 핵심 흐름을 먼저 검증한다.

## 2. 선택 근거

- Next.js App Router: 화면 흐름, 서버 렌더링, Route Handler를 한 저장소에서 관리하고 이후 실제 인증·API로 교체하기 쉽다.
- PostgreSQL + Drizzle: 여행·날짜·장소·방문처럼 관계가 명확한 도메인에 적합하며 스키마와 TypeScript 타입을 가까이 유지한다.
- PWA: 설치 가능한 모바일 경험과 최소 오프라인 일정 열람을 단계적으로 추가할 수 있다.
- 어댑터 경계: Google Maps/Places와 AI 공급자를 UI·도메인에서 분리해 목업과 실서비스 구현을 교체한다.
- 서버 컴포넌트 우선: 읽기 화면의 자바스크립트를 줄이고, 상호작용이 필요한 흐름만 클라이언트 컴포넌트로 둔다.

## 3. 계층

```text
UI (app, features, components)
  -> application (use cases, queries, commands)
    -> domain (entities, policies, types)
      -> ports (maps, places, ai, photo storage, repository)
        -> adapters (mock first, Google/AI/PostgreSQL later)
```

UI는 외부 SDK를 직접 호출하지 않는다. 목업 구현도 실제 어댑터와 같은 인터페이스를 사용한다.

## 4. 폴더 구조

```text
src/
  app/                    # App Router 페이지, 레이아웃, Route Handlers
    (auth)/               # 로그인
    (main)/               # 내 여행, 다녀온 여행, 프로필
    trips/[tripId]/       # 장소, AI 계획, 일정 편집, 완료 정리
  components/
    ui/                   # 버튼, 입력, 카드, 칩, 시트 등 디자인 시스템
    layout/               # 모바일 셸, 헤더, 하단 내비게이션
  features/               # 화면 흐름 단위 컴포넌트와 상태
  domain/                 # Trip, Place, Itinerary, Visit 규칙과 타입
  application/            # 유스케이스 및 어댑터 조합
  adapters/
    ai/                   # MockAIPlanner, 이후 실제 AI
    maps/                 # MockMaps, 이후 Google Maps/Places
    persistence/          # 메모리/Drizzle 저장소
    storage/              # 사진 저장 어댑터
  db/                     # Drizzle 스키마, 마이그레이션, 시드
  mocks/                  # 고정 시나리오와 데모 데이터
  lib/                    # 공통 유틸리티와 설정
public/
  icons/                  # PWA 아이콘
docs/                     # 제품·기술·구현 문서
```

## 5. 라우팅 원칙

핵심 사용자 흐름은 URL로 직접 접근 가능하고 브라우저 뒤로가기가 자연스럽게 동작해야 한다.

```text
/login
/trips
/trips/new
/trips/[tripId]/places
/trips/[tripId]/ai-plan
/trips/[tripId]/itinerary
/trips/[tripId]/complete
/trips/[tripId]/summary
```

AI 일정 시작 URL은 바로 여행 스타일 선택 화면을 보여준다. 장소 보관함은 모든 저장 장소 목록이며, 일정 포함 여부와 미배치는 일정 편집에서 다룬다.

## 6. 데이터와 상태

- MVP 데모 흐름은 브라우저 저장소 기반 목업 저장소로 유지해 페이지 이동 후에도 결과가 남게 한다.
- PostgreSQL 스키마는 초기부터 Drizzle로 정의하되, 실제 연결은 환경 변수가 제공되는 단계에서 활성화한다.
- 서버 원본 상태와 UI 임시 상태를 구분한다. AI 변경 비교, 드래그 중 순서, 완료 정리 입력은 적용 전 임시 상태다.
- 방문 상태는 별점 유무와 미방문 지정으로 파생한다. `rating != null`이면 rated, 별점 없이 완료하면 unrated, 미방문 버튼을 누르면 not_visited다.

## 7. 외부 연동 경계

- `PlacesPort`: 검색, 상세, 중복 식별
- `RoutesPort`: 대중교통 예상 이동시간과 경로
- `AIPlannerPort`: 여행 스타일을 반영한 날짜별 배치안
- `PhotoStoragePort`: 원본·최적화본 업로드와 삭제

첫 단계 구현은 고정 지연과 성공/실패 시나리오를 가진 목업이다. 일정 충돌과 대중교통 경로 실패도 숨겨진 개발 상태가 아니라 사용자가 이해하고 다음 행동을 선택할 수 있는 정식 예외 화면으로 만든다.

## 8. 품질 기준

- 390px 기준 모바일 우선, 데스크톱에서는 중앙 모바일 캔버스
- 키보드 포커스, 명시적 레이블, 44px 이상 터치 영역
- 핵심 흐름의 타입 검사·정적 빌드 통과
- 도메인 규칙 단위 테스트와 주요 라우트 스모크 테스트
- 외부 API 키 없이 전체 데모 가능
