# TripUS 구현 계획

## 목표

Expo React Native 앱과 독립 NestJS API의 기반을 만들고, 실제 지도·AI 키 없이 핵심 사용자 흐름을 연결한다.

## 마일스톤

상태 기준일: 2026-11-09

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

상태: 완료

- Figma 기반 색상·타이포·간격 토큰
- 모바일 앱 셸, 스택, 탭과 공통 컴포넌트
- 여행·저장 장소·일정·방문 기록 스키마
- Google Places/Routes와 OpenAI 일정 생성 목업 어댑터
- 실제 좌표 기반 Google 네이티브 지도 컴포넌트
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

상태: 완료

- 상태 탭 없는 완료 정리
- 방문 장소 별점 1~5점
- 별도 미방문 지정과 되돌리기
- 별점 없는 완료/정리 없는 보관의 미평가 처리
- 방문별 후기와 사진 인라인 UI
- 로컬/S3 호환 원본 사진 저장, 최적화본과 썸네일 생성
- 완료 여행 요약과 사진 갤러리

완료 조건: 일정의 모든 방문이 rated, unrated, not_visited 중 하나로 일관되게 전환된다.

### M5. 실제 연동

상태: 어댑터 구현 완료(실서비스 자격 증명 검증 대기)

- 소셜 인증과 보안 토큰 저장
- Google Places/Routes 어댑터
- OpenAI Responses API와 Structured Outputs 기반 일정 생성 작업
- 서명 URL 기반 사진 업로드, 원본 보존과 메타데이터 없는 파생본 생성

실서비스 검증에는 Google/Apple Client ID, Google Maps API 키, OpenAI API 키·모델, S3 버킷·리전·자격 증명이 필요하다. 기본 로컬 실행은 개발 인증과 결정적 지도·AI 목업, 로컬 사진 저장소를 사용한다.

완료 조건: 목업 어댑터를 환경 설정으로 실제 어댑터와 교체할 수 있고, 공급자 실패가 정상 예외 결과로 처리된다.

### M6. 품질과 출시

상태: 진행 중(코드 기반 완료, 실제 배포 계정 검증 대기)

- React Native Testing Library와 API 통합 테스트 — 모바일 기반 구축, API 통합 범위 확장 진행 중
- Maestro 핵심 흐름 E2E — 로컬 iOS·Android Development Build flow 통과
- SQLite 기반 오프라인 최소 일정 — 완료
- 장소 저장 custom scheme 딥링크와 외부 검색어 전달 — 완료
- 네이티브 공유 확장과 실제 도메인 유니버설 링크 — 배포 도메인·서명 설정 대기
- 접근성 기본 속성, 오프라인 배너와 오류 복구 — 완료, 실제 저사양 기기 점검 대기
- 관측성, 오류 추적과 제품 이벤트 — 구조화 서버 로그·모바일 오류 경계·운영 대시보드 완료
- iOS TestFlight와 Android 내부 테스트 — EAS 프로필·수동 CI 완료, Expo/스토어 계정 연결 대기

완료 조건: 양 플랫폼에서 출시 후보가 핵심 시나리오와 비기능 기준을 통과한다.

## 첫 구현 범위

기술 아키텍처 승인 후 M1부터 M4까지 진행한다. 실제 인증, 지도, AI와 사진 업로드는 포트와 계약을 먼저 만들고 런타임은 목업으로 유지한다.

## 구현 결과

- Google/Apple 로그인과 개발 로그인 → 내 여행 → 여행 생성 → 장소 저장 → AI 일정 → 일정 편집 → 완료 정리 → 완료 여행 목록을 모바일과 API로 연결했다.
- AI 일정은 결정적 목업이 기본이며 OpenAI Responses API + Structured Outputs 어댑터를 환경 설정으로 교체할 수 있다.
- 일정 충돌은 정상 `conflict` 결과로 반환하고, 경로 실패와 일정 충돌 전용 모바일 화면을 제공한다.
- 완료 정리에서 별점은 `rated`, 별도 미방문은 `not_visited`, 입력 없이 보관한 방문은 `unrated`로 저장한다.
- Google Places Text Search(New), Google Routes, OpenAI Responses API, S3 호환 사진 저장을 환경 설정으로 교체할 수 있다.
- Google Places 검색 좌표를 저장 장소와 일정 계약에 보존하고, 일정 편집의 날짜별 지도에 실제 순서 마커·연결선·이동 마커를 표시한다. 기존 장소는 Place Details로 좌표를 점진 보강한다.
- Android와 iOS Development Build에서 실제 PostgreSQL을 사용해 개발 로그인, AI 일정 생성, 일정 편집, 대중교통 목업 경로, 별점·미방문, 사진 업로드와 완료 기록 갤러리까지 확인했다.
- 실제 공급자 자격 증명 통합 검증과 EAS 빌드 실행은 외부 계정 연결 단계에 남아 있다.
- Free/Plus의 여행·AI 생성 한도를 서버에서 강제하고 프로필과 행동 맥락에서 사용량을 표시한다. AI 공급자 실패는 무료 횟수를 차감하지 않는다.
- 여행 생성·수정에서 기본 숙소를 저장하고, 일정 편집에서 날짜별 활동 시간과 출발·종료 숙소를 직접 변경해 AI 입력에 반영한다. 별도의 숙소 및 날짜 설정 화면은 두지 않는다. 잠근 일정은 AI 재생성에서도 유지하며 최근 AI 변경은 기기에서 한 번 되돌릴 수 있다.
- 대중교통 경로 확인 후 Google Maps의 대중교통 길 찾기로 연결한다.
- SQLite 오프라인 스냅샷, `tripus://save-place` 딥링크, 로컬 여행 알림, 제품 이벤트와 전역 오류 복구를 추가했다.
- AWS와 EAS의 수동 배포 워크플로를 추가했다. 실제 배포는 AWS OIDC 역할, Expo project ID·token, Apple·Google 배포 자격 증명 연결 후 수행한다.

## 확정된 구현 기준

- Expo 사용과 Development Build 기준
- CNG 적용, 생성된 네이티브 디렉터리는 초기 버전 관리 대상에서 제외
- 로컬 빌드 우선, EAS는 배포 단계에서 도입
- NestJS와 기본 Express 어댑터 선택
- 단일 모노레포 안의 독립 앱/API 구조
- REST + OpenAPI 계약

위 기준에 따라 프로젝트 기반 구현을 시작한다.
