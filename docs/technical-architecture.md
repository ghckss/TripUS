# TripUS 기술 아키텍처

## 1. 확정 방향

TripUS 클라이언트는 Expo 기반 React Native 앱으로 개발한다. 서버는 앱과 런타임 및 배포 단위가 분리된 독립 API로 구성한다.

- 모바일: React Native + Expo + Expo Router + TypeScript
- API: Node.js LTS + NestJS + TypeScript
- 데이터베이스: PostgreSQL
- ORM/마이그레이션: TypeORM + 명시적 migration
- API 계약: REST JSON + OpenAPI
- 저장소: pnpm workspace 기반 모노레포, 앱과 서버는 독립 실행·배포
- API 배포: AWS Lambda Web Function(Node.js 24/arm64) + AWS CDK
- 운영 데이터: Aurora PostgreSQL Serverless v2 + RDS Proxy, S3
- 네이티브 프로젝트 관리: Expo Development Build + CNG(Continuous Native Generation)
- 빌드 운영: 초기 로컬 빌드, 배포 단계에서 EAS Build/Submit 도입
- 외부 연동: Google Maps/Places, OpenAI, 사진 저장소를 포트와 어댑터로 분리

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
    src/app/              # Expo Router 진입점만 유지
    src/domains/          # 도메인별 페이지, 로직, 컴포넌트, API
      trips/
        pages/
        components/
        hooks/
        api/
        model/
      places/
      itineraries/
      trip-records/
    src/shared/           # 두 개 이상 도메인이 공유하는 UI와 기반 코드
  api/                    # NestJS API
    src/modules/          # identity, trips, places, itineraries, trip-records, photos
      trips/
        trips.module.ts
        application/      # 유스케이스와 입출력 DTO
        domain/           # 엔티티, 값 객체, 정책, 포트
        presentation/     # Nest Controller
        infrastructure/   # TypeORM repository와 외부 서비스 어댑터
    src/common/           # guard, filter, interceptor, logging
    src/config/           # 환경 설정과 검증
packages/
  api-client/             # OpenAPI에서 생성한 모바일 API 클라이언트
  contracts/              # 생성된 OpenAPI 문서
docs/
infra/                    # AWS CDK 데이터/API 스택과 배포 산출물 패키징
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

### 도메인과 페이지 기준 배치

모바일 코드는 화면 종류가 아니라 제품 도메인을 최상위 경계로 사용한다. `src/app`은 Expo Router가 요구하는 경로와 레이아웃만 가지며 실제 화면 구현을 소유하지 않는다.

```text
src/domains/trips/
  pages/
    trip-list-page.tsx
    trip-detail-page.tsx
    new-trip-page/
      new-trip-page.tsx
      trip-date-fields.tsx       # 이 페이지에서만 사용하는 컴포넌트
      use-new-trip-form.ts       # 이 페이지에서만 사용하는 로직
  components/                    # trips의 여러 페이지가 공유할 때만 사용
  hooks/
  api/
  model/
  index.ts                       # 다른 도메인에 공개하는 최소 API
```

배치 규칙은 다음과 같다.

1. 한 페이지에서만 사용하는 로직과 컴포넌트는 해당 페이지 폴더에 둔다.
2. 같은 도메인의 두 페이지 이상에서 재사용할 때만 도메인 공통 폴더로 올린다.
3. 두 도메인 이상에서 의미가 동일할 때만 `src/shared`로 올린다.
4. 도메인 간 참조는 상대 도메인의 공개 진입점만 사용하고 내부 파일을 임의로 참조하지 않는다.
5. 서버 응답 타입은 `packages/api-client`에서 가져오며 모바일에 서버 Entity를 복제하지 않는다.

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

- 서버 상태: 도메인별 API 함수와 화면 전용 hook에서 관리하며 `@tripus/api-client` 생성 클라이언트를 사용
- 폼과 화면 임시 상태: React local state
- 복잡한 캐시 무효화가 필요해질 때 TanStack Query 도입
- 복잡한 일정 편집 초안이 여러 화면으로 확장될 때만 Zustand 도입
- 인증 토큰: OS 보안 저장소 사용, 일반 AsyncStorage에 저장하지 않음
- 오프라인 최소 일정: SQLite 기반 읽기 캐시를 단계적으로 도입

모바일은 `@tripus/api-client`의 생성 클라이언트만 사용한다. 로컬 Development Build에서는 Expo 개발 서버 호스트의 3000 포트를 기본 API 주소로 사용하며, 다른 포트나 실제 기기를 사용할 때는 `EXPO_PUBLIC_API_URL`로 명시한다. Android Emulator에서 호스트 루프백을 직접 지정할 때는 `10.0.2.2`를 사용한다.

전역 상태 라이브러리를 프로젝트 시작부터 모든 데이터에 사용하지 않는다. 서버 원본 데이터와 화면 편집 초안을 분리한다.

### 인증

- 모바일은 Google OAuth Authorization Code + PKCE와 iOS 네이티브 Sign in with Apple에서 ID 토큰을 얻는다.
- 서버는 공급자 JWKS 서명, issuer, audience와 만료를 검증한 뒤에만 사용자를 연결한다.
- TripUS 액세스 토큰은 15분, 불투명 리프레시 토큰은 30일이며 리프레시할 때마다 DB 트랜잭션으로 회전하고 이전 토큰을 폐기한다.
- 모바일 세션은 Expo SecureStore(Android Keystore/iOS Keychain)에만 저장한다.
- `AUTH_MODE=development`에서만 개발용 사용자와 로그인 엔드포인트를 허용하며 운영은 `AUTH_MODE=jwt`를 사용한다.
- AWS에 배포된 development 인증 endpoint는 `IamAuth`로 제한한다. `ApplicationManaged` 공개 endpoint는 JWT 모드에서만 생성한다.

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
- 사진은 서버가 발급한 업로드 URL을 사용한다. 로컬 개발은 API 스트리밍 업로드, 운영은 S3 호환 서명 PUT URL을 사용한다.
- 원본은 변형 없이 보존하고 사용자별 총 저장 용량 한도를 두지 않는다. 안전을 위한 파일당 100MB 제한은 적용한다.
- 화면 표시용 최적화본과 480px 썸네일은 Sharp로 회전 보정 후 JPEG로 생성하며 파생본에는 원본 메타데이터를 복사하지 않는다.

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
GET  /v1/trips/:tripId/places/search
POST /v1/trips/:tripId/ai-plans
PUT  /v1/trips/:tripId/itinerary
POST /v1/trips/:tripId/routes/transit
POST /v1/trips/:tripId/completion
POST /v1/trips/:tripId/photos
POST /v1/trips/:tripId/photos/:photoId/confirm
```

## 7. 외부 연동 경계

- `PlacesPort`: 장소 검색, 상세, 중복 식별
- `RoutesPort`: 대중교통 예상 이동시간과 경로
- `AIPlannerPort`: 여행 스타일 기반 날짜별 배치안
- `PhotoStoragePort`: 원본·최적화본 업로드와 다운로드 URL 발급
- `SocialIdentityPort`: Google·Apple ID 토큰 검증

Google 지도 연동은 `MAPS_PROVIDER=mock|google`로 전환한다. `google` 모드에서는 서버에만 `GOOGLE_MAPS_API_KEY`를 주입하고 Places API(New) Text Search와 Routes API Compute Routes를 호출한다. 응답 필드는 비용과 지연을 줄이도록 필요한 field mask만 요청한다. 경로를 찾지 못하거나 공급자 호출이 실패하면 500 오류 대신 `unavailable` 도메인 결과를 반환한다.

### OpenAI 일정 생성

AI 공급자는 OpenAI로 확정한다. 모바일은 OpenAI API를 직접 호출하지 않으며 API 키, 프롬프트, 모델 설정은 NestJS 서버에만 둔다.

```text
ai-planning/
  domain/
    ai-planner.port.ts
    itinerary-proposal.ts
  application/
    generate-itinerary.service.ts
  infrastructure/
    mock-ai-planner.adapter.ts
    openai-planner.adapter.ts
    schemas/itinerary-proposal.schema.ts
  presentation/
    ai-planning.controller.ts
```

- OpenAI 공식 JavaScript SDK와 Responses API를 사용한다.
- 일정 결과는 Structured Outputs와 JSON Schema로 날짜, 장소 ID, 순서, 미배치 사유를 강제한다.
- MVP에서는 생성 결과를 도메인 검증한 뒤 현재 일정 전체에 원자적으로 반영한다. 향후 비교·승인이 필요해지면 제안 리소스를 별도로 둔다.
- 모델명은 코드에 고정하지 않고 `OPENAI_MODEL` 환경 변수로 관리한다.
- API 키는 `OPENAI_API_KEY`로 서버에만 주입하고 로그, OpenAPI, 모바일 번들에 노출하지 않는다.
- 거부, 불완전 응답과 스키마 오류는 사용자에게 재시도 가능한 생성 실패로 전달한다.
- 요청은 15초 타임아웃, 2회 재시도, 1,200 출력 토큰을 기본 상한으로 하며 모두 환경 변수로 조정한다.
- 한 번에 최대 100개 저장 장소와 사용자별 분당 5회 생성으로 비용 폭주를 막고, 프롬프트 내용 없이 입출력 토큰 수만 서버 로그에 남긴다.

참고: [OpenAI Structured Outputs 공식 문서](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)

MVP 기반에서는 Google Maps와 OpenAI 포트에 결정적 목업 어댑터를 먼저 연결한다. 실제 OpenAI 어댑터는 배포 환경의 키와 모델이 정해진 뒤 같은 포트로 교체한다.

환경 변수 기본값은 `AI_PLANNER_PROVIDER=mock`이다. 실제 어댑터는 `AI_PLANNER_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL` 세 값을 모두 서버에 설정했을 때만 활성화한다.

### 사진 저장

- `PHOTO_STORAGE_PROVIDER=local|s3`로 저장소를 교체한다.
- 로컬 모드는 `.data/photos` 아래에 원본과 파생본을 저장하고 인증된 API 파일 경로로 제공한다.
- S3 모드는 AWS SDK v3의 `S3Client`와 presigner를 사용한다. 원본 업로드 URL은 10분, 조회 URL은 1시간 유효하며 업로드의 `content-type`도 서명한다.
- S3 호환 개발 저장소는 `PHOTO_S3_ENDPOINT`와 path-style 요청으로 연결할 수 있다.
- 원본 저장 용량 확대는 Plus 혜택이 아니며 사용자별 원본 총량 제한을 두지 않는다.

## 8. 테스트

- 도메인과 API 단위 테스트: Vitest
- API 통합 테스트: Nest TestingModule + Supertest + 테스트 PostgreSQL
- 모바일 컴포넌트: React Native Testing Library
- 네이티브 핵심 흐름 E2E: Maestro 우선 검토
- 계약 검증: OpenAPI 스키마 생성 및 모바일 클라이언트 타입 빌드

핵심 E2E는 로그인 → 내 여행 → 여행 생성 → 장소 저장 → AI 일정 → 일정 편집 → 완료 정리를 포함한다.

## 9. AWS 서버리스 배포

NestJS API는 컨테이너 상시 서버가 아니라 Lambda Web Function으로 배포한다. 일반적인 요청/응답 HTTP API이므로 API Gateway 이벤트 변환 없이 Node HTTP 서버를 실행하고, 예약 작업이나 큐 소비가 필요할 때는 별도의 Lambda Event Function을 추가한다.

- `TripUs-<stage>-Data`: VPC, Aurora PostgreSQL Serverless v2, RDS Proxy, 사진/코드 S3, Secrets Manager
- `TripUs-<stage>-Api`: API 산출물, TypeORM 배포 마이그레이션, Web Function revision/endpoint
- Web Function 런타임 제약에 맞춰 Linux arm64용 Sharp 바이너리를 포함한 zip을 생성한다.
- DB는 격리 서브넷에 두고 API와 배포 전용 migration Lambda만 RDS Proxy를 통해 접근한다.
- migration은 관리자 DB 계정을 사용하고 API는 CRUD 권한만 가진 `tripus_app` 계정을 사용한다. 두 비밀번호를 분리하며, 관리자 계정은 즉시 자동 회전하고 앱 계정은 최초 migration으로 역할을 만든 뒤 자동 회전을 활성화한다.
- CloudFormation custom resource가 migration을 먼저 실행하며, 실패하면 새 API revision 배포도 실패한다.
- 개발 stage는 목업 공급자를 기본값으로 사용해 NAT Gateway를 만들지 않는다. OpenAI, Google 또는 JWT/JWKS를 활성화하면 외부 통신용 NAT Gateway를 한 개 생성한다.
- CDK strict synth와 `cdk-nag` AWS Solutions 검사를 CI에서 실행한다.
- API는 요청 ID를 응답과 JSON 로그에 기록하고, 표준 오류 형식과 DB readiness endpoint를 제공한다.
- Web Function 5xx·스로틀과 migration 실패를 CloudWatch Alarm으로 감시한다.

운영 키 주입과 실제 명령은 [AWS 배포 가이드](./aws-deployment.md)를 따른다.

## 10. 아직 유예한 선택

- 사진 CDN과 이미지 변환 비동기 파이프라인
- 비동기 AI 일정 작업을 위한 SQS/Event Function
- CloudFront/WAF 및 사용자 지정 API 도메인
- OpenAI 모델과 요청별 비용·품질 기준
- Google 지도 네이티브 지도 화면과 클라이언트 SDK 범위
- 모노레포를 향후 별도 저장소로 분리할 시점

이 선택은 현재 기반 구현을 막지 않으며 각 포트 뒤에 둔다.
