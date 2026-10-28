# TripUS 기술 아키텍처

## 1. 확정 방향

TripUS 클라이언트는 Expo 기반 React Native 앱으로 개발한다. 서버는 앱과 런타임 및 배포 단위가 분리된 독립 API로 구성한다.

- 모바일: React Native + Expo + Expo Router + TypeScript
- API: Node.js LTS + NestJS + TypeScript
- 데이터베이스: PostgreSQL
- ORM/마이그레이션: TypeORM + 명시적 migration
- API 계약: REST JSON + OpenAPI
- 저장소: pnpm workspace 기반 모노레포, 앱과 서버는 독립 실행·배포
- 네이티브 프로젝트 관리: Expo Development Build + CNG(Continuous Native Generation)
- 빌드 운영: 초기 로컬 빌드, 배포 단계에서 EAS Build/Submit 도입
- 외부 연동: Google Maps/Places, AI, 사진 저장소를 포트와 어댑터로 분리

의존성 버전은 프로젝트 생성 시점의 최신 버전을 무조건 사용하지 않는다. Expo SDK 호환표와 각 패키지의 안정 버전을 확인해 정확한 버전으로 고정하고 lockfile을 커밋한다.

## 2. 선택 근거

### Expo 기반 React Native

- React Native는 신규 앱에 Expo 같은 프레임워크 사용을 권장한다.
- Expo Router는 파일 기반 라우팅, 타입 라우트, 딥링크와 네이티브 스택을 함께 제공한다.
- 장소 공유 진입, 사진 선택, 푸시, 앱 링크처럼 TripUS가 이후 요구할 네이티브 기능을 단계적으로 추가하기 쉽다.
- Expo Go에 머물지 않고 초기부터 Development Build를 기준으로 한다. 공유 확장, 지도 설정 등 네이티브 구성이 필요한 기능을 검증하기 위해서다.

### 별도 NestJS API

- 모바일 릴리스 주기와 서버 배포 주기를 분리할 수 있다.
- AI 키, Google 서버 키, 사진 저장소 자격 증명을 앱 번들에 포함하지 않는다.
- Module, Controller, Provider와 의존성 주입 규칙으로 여러 기능의 구조를 일관되게 유지할 수 있다.
- `@nestjs/typeorm`을 통해 TypeORM Repository를 모듈 단위로 주입하고 테스트 대역으로 교체하기 쉽다.
- DTO 검증과 `@nestjs/swagger`를 사용해 모바일 앱과 공유할 OpenAPI 계약을 생성한다.
- 기본 `@nestjs/platform-express` 어댑터로 시작한다. 실제 병목이 측정되기 전에는 HTTP 어댑터를 성능만으로 변경하지 않는다.

### PostgreSQL + TypeORM

- 여행, 날짜, 저장 장소, 일정 항목, 방문 기록처럼 관계와 무결성이 중요한 데이터에 적합하다.
- 엔티티 클래스와 Repository 패턴으로 도메인별 데이터 접근 코드를 구성한다.
- 관계, 트랜잭션과 QueryBuilder를 일관된 API로 사용할 수 있다.
- 마이그레이션을 TypeScript 저장소에서 관리하고 외래 키, 유니크 제약, 인덱스를 데이터베이스 수준에서 명시한다.
- 운영 환경에서는 `synchronize`를 사용하지 않고 검토된 migration만 적용한다.

## 3. 저장소 구조

앱과 서버는 분리된 배포 단위지만 초기에는 계약 변경을 원자적으로 관리하기 위해 모노레포에 둔다.

```text
apps/
  mobile/                 # Expo React Native 앱
    src/app/              # Expo Router 라우트
    src/features/         # auth, trips, places, itinerary, completion
    src/components/       # 디자인 시스템과 공통 UI
    src/adapters/         # API, 지도, 로컬 저장소 어댑터
  api/                    # NestJS API
    src/modules/          # auth, trips, places, itinerary, visits, photos
      trips/
        trips.module.ts
        trips.controller.ts
        application/     # command/query service와 DTO
        domain/          # 엔티티와 정책
        infrastructure/  # TypeORM entity/repository adapter
    src/common/           # guard, filter, interceptor, logging
    src/config/           # 환경 설정과 검증
packages/
  api-client/             # OpenAPI에서 생성한 모바일 API 클라이언트
  contracts/              # API 요청·응답 스키마와 생성 타입
  config/                 # 공유 TypeScript/ESLint 설정
  test-fixtures/          # 목업 시나리오와 테스트 데이터
docs/
```

`apps/mobile`은 `apps/api`의 소스에 직접 의존하지 않는다. 모바일은 `packages/contracts`의 공개 계약 또는 OpenAPI에서 생성한 클라이언트 타입만 사용한다.

### 네이티브 프로젝트 관리와 빌드

- Expo Go가 아니라 Development Build를 개발 기준으로 사용한다.
- CNG를 적용해 `app.json`/동적 앱 설정과 config plugin을 네이티브 구성의 원본으로 삼는다.
- 초기에는 생성된 `ios/`, `android/` 디렉터리를 버전 관리하지 않으며 수동 수정하지 않는다.
- 네이티브 프로젝트 재생성이 필요하면 변경 내용을 앱 설정 또는 config plugin에 먼저 반영한 뒤 `expo prebuild --clean`으로 재생성한다.
- 개발 초기에는 Xcode와 Android Studio를 사용하는 로컬 빌드로 검증한다.
- EAS Build와 EAS Submit은 내부 배포 또는 스토어 배포가 필요한 M6에서 도입한다.

## 4. 모바일 아키텍처

### 라우팅

```text
src/app/
  (auth)/login.tsx
  (tabs)/trips/index.tsx
  (tabs)/completed/index.tsx
  (tabs)/profile/index.tsx
  trips/new.tsx
  trips/[tripId]/places.tsx
  trips/[tripId]/ai-plan.tsx
  trips/[tripId]/itinerary.tsx
  trips/[tripId]/complete.tsx
  trips/[tripId]/summary.tsx
```

AI 일정 시작 화면은 여행 스타일 선택이다. 장소 보관함은 모든 저장 장소의 단순 목록이고, 일정 포함 여부와 미배치는 일정 편집에서 관리한다.

### 상태 관리

- 서버 상태: TanStack Query
- 폼: React Hook Form + 스키마 검증
- 화면 임시 상태: React local state
- 복잡한 일정 편집 초안: 필요성이 확인될 때만 Zustand 도입
- 인증 토큰: OS 보안 저장소 사용, 일반 AsyncStorage에 저장하지 않음
- 오프라인 최소 일정: SQLite 기반 읽기 캐시를 단계적으로 도입

전역 상태 라이브러리를 프로젝트 시작부터 모든 데이터에 사용하지 않는다. 서버 원본 데이터와 화면 편집 초안을 분리한다.

### UI

- React Native `StyleSheet`와 디자인 토큰을 기본으로 사용한다.
- 색상, 타이포그래피, 간격, 반경, 그림자 토큰을 모바일 앱 내부에 둔다.
- 접근성 레이블, 동적 글꼴, Safe Area, 44pt 이상 터치 영역을 기본 기준으로 한다.
- 초기부터 iOS와 Android를 모두 검증한다.

## 5. 서버 아키텍처

서버는 모듈러 모놀리스로 시작한다.

```text
Nest Controller
  -> DTO validation pipe
  -> application service/use case
  -> domain policy
  -> repository/external port provider
  -> TypeORM repository or external adapter
```

- 모바일이 데이터베이스에 직접 접근하지 않는다.
- Controller 안에 TypeORM Repository/QueryBuilder 호출이나 외부 SDK 호출을 직접 섞지 않는다.
- Nest Module은 기능 경계를 정의하고 외부 모듈은 공개된 Provider만 사용한다.
- 인증과 소유권 검사는 데이터 접근 계층 가까이에서 반복 검증한다.
- AI 일정 생성은 비동기 작업으로 확장할 수 있게 요청과 결과 모델을 분리한다.
- 사진은 서버가 발급한 서명 업로드 URL을 사용하고 업로드 완료 후 서버에서 소유권과 메타데이터 제거 결과를 확정한다.

## 6. API 계약

초기 API는 REST JSON을 사용한다. GraphQL과 tRPC는 도입하지 않는다.

- 요청 DTO와 전역 ValidationPipe가 입력 검증의 기준이다.
- `@nestjs/swagger`로 OpenAPI 문서를 자동 생성한다.
- 모바일 API 타입은 OpenAPI에서 생성하거나 같은 스키마 패키지의 공개 타입만 사용한다.
- 오류 응답은 `code`, `message`, `details`, `requestId`의 일관된 형태를 가진다.
- 일정 충돌과 경로 실패는 500 오류가 아니라 정상 도메인 결과로 모델링한다.

예시:

```text
POST /v1/trips
GET  /v1/trips/:tripId
POST /v1/trips/:tripId/places
POST /v1/trips/:tripId/ai-plans
PUT  /v1/trips/:tripId/itinerary
POST /v1/trips/:tripId/completion
```

## 7. 외부 연동 경계

- `PlacesPort`: 장소 검색, 상세, 중복 식별
- `RoutesPort`: 대중교통 예상 이동시간과 경로
- `AIPlannerPort`: 여행 스타일 기반 날짜별 배치안
- `PhotoStoragePort`: 원본·최적화본 업로드와 삭제
- `AuthPort`: 소셜 로그인 식별자 검증

MVP 기반에서는 Google Maps와 AI를 결정적 목업 어댑터로 구현한다. 목업도 실제 포트와 동일한 계약을 사용한다.

## 8. 테스트

- 도메인과 API 단위 테스트: Vitest
- API 통합 테스트: Nest TestingModule + Supertest + 테스트 PostgreSQL
- 모바일 컴포넌트: React Native Testing Library
- 네이티브 핵심 흐름 E2E: Maestro 우선 검토
- 계약 검증: OpenAPI 스키마 생성 및 모바일 클라이언트 타입 빌드

핵심 E2E는 로그인 → 내 여행 → 여행 생성 → 장소 저장 → AI 일정 → 일정 편집 → 완료 정리를 포함한다.

## 9. 아직 유예한 선택

- 소셜 인증 공급자와 로그인 제공자 범위
- API 배포 플랫폼과 컨테이너 오케스트레이션
- PostgreSQL 호스팅 서비스
- 객체 저장소와 CDN
- AI 모델과 공급자
- Google Maps 클라이언트/서버 API의 정확한 조합
- 모노레포를 향후 별도 저장소로 분리할 시점

이 선택은 현재 기반 구현을 막지 않으며 각 포트 뒤에 둔다.
