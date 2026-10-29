# TripUS 구현 계획

## 목표

Expo React Native 앱과 독립 NestJS API의 기반을 만들고, 실제 지도·AI 키 없이 핵심 사용자 흐름을 연결한다.

## 마일스톤

상태 기준일: 2026-10-29

### M0. 기술 결정과 계약

- Expo React Native + Expo Router 확정
- NestJS 독립 API와 PostgreSQL + TypeORM 확정
- pnpm workspace 모노레포 구성 확정
- 앱/API 책임과 초기 REST 계약 정의
- 인증·사진·지도·AI 포트 정의

완료 조건: 모바일이 서버 구현에 직접 의존하지 않고 독립 실행·배포 가능한 구조가 문서와 코드에 일치한다.

### M1. 모노레포와 실행 기반

상태: 완료

- `apps/mobile`, `apps/api`, `packages/contracts` 생성
- `packages/api-client`에 OpenAPI 기반 클라이언트 생성 경계 구성
- 공유 TypeScript와 품질 설정
- Expo Development Build + CNG 기준 설정
- iOS Simulator와 Android Emulator에서 로컬 네이티브 빌드 검증
- NestJS health endpoint, 전역 ValidationPipe와 OpenAPI
- PostgreSQL 로컬 개발 환경과 TypeORM DataSource·초기 마이그레이션
- CI에서 타입 검사, 테스트, 빌드

완료 조건: 모바일과 API를 각각 실행할 수 있고 API 계약 타입을 모바일에서 사용할 수 있다.

### M2. 디자인 시스템과 목업 도메인

상태: 완료(지도는 목업)

- Figma 기반 색상·타이포·간격 토큰
- 모바일 앱 셸, 스택, 탭과 공통 컴포넌트
- 여행·저장 장소·일정·방문 기록 스키마
- Google Places/Routes와 OpenAI 일정 생성 목업 어댑터
- 기능별 예외 UI 기반

완료 조건: iOS와 Android에서 핵심 라우트와 디자인 시스템을 확인할 수 있다.

### M3. 계획 핵심 흐름

상태: 완료

- 로그인 목업
- 내 여행과 여행 생성
- 모든 저장 장소의 단순 장소 보관함
- 장소 검색·저장 목업
- 여행 스타일 선택으로 시작하는 AI 일정
- 날짜별 일정 편집과 미배치 관리
- 일정 충돌·대중교통 경로 실패 예외 화면

완료 조건: 로그인부터 일정 편집까지 API를 거쳐 한 방향으로 끊김 없이 진행된다.

### M4. 여행 완료와 기록

상태: 핵심 완료(사진 저장은 M5)

- 상태 탭 없는 완료 정리
- 방문 장소 별점 1~5점
- 별도 미방문 지정과 되돌리기
- 별점 없는 완료/정리 없는 보관의 미평가 처리
- 방문별 후기와 사진 인라인 UI
- 완료 여행 요약

완료 조건: 일정의 모든 방문이 rated, unrated, not_visited 중 하나로 일관되게 전환된다.

### M5. 실제 연동

상태: 준비됨(OpenAI 어댑터 구현, 인증·지도·사진은 미착수)

- 소셜 인증과 보안 토큰 저장
- Google Places/Routes 어댑터
- OpenAI Responses API와 Structured Outputs 기반 일정 생성 작업
- 서명 URL 기반 사진 업로드, 최적화와 EXIF 제거
- SQLite 기반 오프라인 최소 일정
- 공유 메뉴 진입과 앱/유니버설 링크

완료 조건: 목업 어댑터를 환경 설정으로 실제 어댑터와 교체할 수 있다.

### M6. 품질과 출시

- React Native Testing Library와 API 통합 테스트
- Maestro 핵심 흐름 E2E
- 접근성, 저사양 기기, 느린 네트워크 점검
- 관측성, 오류 추적과 제품 이벤트
- iOS TestFlight와 Android 내부 테스트

완료 조건: 양 플랫폼에서 출시 후보가 핵심 시나리오와 비기능 기준을 통과한다.

## 첫 구현 범위

기술 아키텍처 승인 후 M1부터 M4까지 진행한다. 실제 인증, 지도, AI와 사진 업로드는 포트와 계약을 먼저 만들고 런타임은 목업으로 유지한다.

## 구현 결과

- 로그인 목업 → 내 여행 → 여행 생성 → 장소 저장 → AI 일정 → 일정 편집 → 완료 정리 → 완료 여행 목록을 모바일과 API로 연결했다.
- AI 일정은 결정적 목업이 기본이며 OpenAI Responses API + Structured Outputs 어댑터를 환경 설정으로 교체할 수 있다.
- 일정 충돌은 정상 `conflict` 결과로 반환하고, 경로 실패와 일정 충돌 전용 모바일 화면을 제공한다.
- 완료 정리에서 별점은 `rated`, 별도 미방문은 `not_visited`, 입력 없이 보관한 방문은 `unrated`로 저장한다.
- Android Development Build에서 실제 PostgreSQL을 사용해 AI 일정 생성부터 미평가 보관 요약까지 확인했다.
- 실제 소셜 인증, Google Places/Routes, 사진 저장과 배포 파이프라인은 M5/M6 범위다.

## 확정된 구현 기준

- Expo 사용과 Development Build 기준
- CNG 적용, 생성된 네이티브 디렉터리는 초기 버전 관리 대상에서 제외
- 로컬 빌드 우선, EAS는 배포 단계에서 도입
- NestJS와 기본 Express 어댑터 선택
- 단일 모노레포 안의 독립 앱/API 구조
- REST + OpenAPI 계약

위 기준에 따라 프로젝트 기반 구현을 시작한다.
