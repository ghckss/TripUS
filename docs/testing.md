# TripUS 테스트 가이드

## 자동 품질 검사

루트에서 아래 명령으로 API·모바일·인프라 테스트를 함께 실행한다.

```bash
pnpm test
```

모바일 테스트는 Expo SDK 58 기준의 Jest 30, `jest-expo`, React Native Testing Library 14를 사용한다. 사용자에게 보이는 결과와 접근성 역할을 우선 검증하고 구현 세부사항의 snapshot은 만들지 않는다.

## AI 일정 프롬프트 검증

API 테스트는 기본 여행 정보의 입력 구성을 검증한다. 숙박 수와 포함 날짜 수(당일 0박 1일, 일광절약시간 전환 포함), 숙소·시작/종료 지점과 시각·등록 장소 전체 정보·대상 날짜를 확인한다. 선택한 여행 방식 6종이 preferences.themes로 전달되고, 전체 생성·날짜별 생성·실제 모델 요청 JSON까지 유지되는지 검증한다. 밀도와 관광 수 목표는 모델 입력에 포함하지 않는다. 과거 최근 설정이나 대기 작업에 density가 있어도 응답·AI 입력·재저장에 전파되지 않아야 한다. 추가 요청·이전 검토 문맥은 모델 입력에 섞이지 않는지도 확인한다.

일정 생성은 웹 검색 도구를 사용하는 모델을 한 번만 호출한다. 모킹한 API 요청에서 live web_search·필수 도구 선택·JSON 출력 형식이 함께 전달되는지 검증한다. 응답은 days/date/visits이며 등록·신규 장소를 한 배열에 담고, 등록 장소의 ID와 대상 날짜는 제공한 참조로 제한한다. 등록 장소가 없어도 신규 방문을 반환할 수 있어야 하며 빈 배열을 강제하는 출력 필드나 방문 수 min/max를 두지 않는다. 실제 모델 JSON Schema에 reason·이전 방문 목록·활동·이동·position 속성이 없는지 확인한다. 실제 검색 정확도와 모델/계정별 도구 지원은 단위 테스트의 보장 범위 밖이다.

저장 테스트는 혼합 방문 배열 순서·AI 시각과 체류 유지, 신규 장소 설명 메모, 기존 사용자 메모 보존·빈 메모 보충, 고정 일정 보존, 검색 실패 방문 유지, 동일 장소 반복 방문, 미방문 등록 장소 보존·오래된 AI 추천 정리, 기술적 실패·참조 오류 시 기존 일정 보존과 부분 신규 장소 정리를 검증한다. 서버 품질 판정·자동 수정·추가 호출은 없어야 한다. 빈 출력도 거절하지 않으며 반환 날짜 수·방문 수와 생성 범위 내 실제 저장 방문 수·숙소 연결 수를 구분해 기록하는지 확인한다. 일반 테스트는 외부 API나 실제 여행 DB를 호출하지 않는다.

앱 테스트는 밀도 선택·설명 버튼·알차게/균형 있게 선택지가 표시되지 않고, 최근 요청을 불러온 뒤 생성해도 요청에 density가 없는지 검증한다. 여행 방식·예산 등 남아 있는 선택은 그대로 불러오고 전송해야 한다. 이전 밀도별 실생성 비교 결과는 product-change-log.md의 과거 기록이며 현재 서비스의 생성 기준으로 사용하지 않는다.

## 방문 시간표·구간 소요시간 검증

AI 응답에는 activities나 이동 활동·이동 수단·소요시간 필드가 없다. 생성 결과를 저장할 때만 호환용 이전 활동을 빈 배열로 교체한다. 저장 테스트는 장소/이전 활동의 같은 트랜잭션 교체, 날짜별 범위·다른 날 보존, 이전 클라이언트의 활동 생략/빈 배열 의미를 확인한다. 기존 이동·휴식 활동이 현재 장소 순서나 소요시간 표시를 변경하지 않는지 검증한다. 과거 활동 JSON과 오프라인 되돌리기 스냅샷에 남은 reason이 API 응답과 저장 요청에 섞이지 않는지도 확인한다.

경로 API 테스트는 여행 소유권·장소 소속, 저장 장소와 시작/종료 경계의 Google ID 해석, 방향과 출발 시각 전달, 대중교통 미지원 시 사용자가 선택한 실제 도보·차량 경로의 순차 폴백, 추가 요청의 최대 도보 시간 초과 거절, 모든 경로 실패의 unavailable 처리를 검증한다. 일정 GET은 경로 조회 없이 이전 AI 이동시간을 비워 반환해야 한다. 앱 테스트는 현재 position 기준의 카드·지도 순서, DnD 이후 새 구간의 스피너→분 표시, 도보·차량 폴백 라벨, 이전 순서의 늦은 응답 무시, 방향별 캐시, 실패 시 과거 AI 시간 미사용, 여행지 시간대·날짜를 넘는 출발 시각 변환을 확인한다. 수동 변경은 방문 시각을 자동 재배치하지 않는다. AI 저장 테스트는 역전된 모델 방문을 시작 시각순으로 저장하고, 같은 비동기 작업을 여러 작업자가 발견해도 한 번만 실행하며, 동일 Google 장소의 동시 생성은 기존 엔티티를 재사용하는지 확인한다. 단위 테스트는 외부 Google/AI API를 실제로 호출하지 않고 응답을 모킹하며, 배포 전 실제 Google 키로 대표 일본 구간의 TRANSIT 빈 응답과 허용 범위 안의 대체 수단 성공을 별도로 확인한다.

로컬 실행 전 `pnpm --filter @tripus/api migration:run`으로 itinerary_activities 컬럼을 추가한다. 기존 여행의 활동은 빈 배열로 시작하며 재생성 전까지 기존 장소 일정은 그대로다.

## AI 일정 생성 실패 로그 확인

서버의 `ai.generation.failed` 이벤트를 `generationId`·`tripId`로 찾는다. `stage`는 실패한 처리 단계이고 `reason`·`details`는 모델/API·응답 형식 등 기술적 실패 사유다. 검색 연결 실패는 `visits_materialized.unresolved`에 기록하며 해당 방문은 유지한다. 전문 검토·통합 수정 로그와 검토용 초안 스냅샷은 더 이상 생성하지 않는다. output_received는 응답 날짜 수·방문 수·날짜별 방문 수, completed는 해당 생성 범위의 savedVisitCount·savedVisitsByDate와 lodgingConnectionCount를 기록한다. 빈 출력은 방문 0·숙소 연결 수를 구분해 기록하며 실패로 바꾸거나 재생성하지 않는다. 날짜별 업데이트 응답에 여행 전체 일정이 있어도 대상 날짜만 집계한다. 인증정보는 로그에 기록하지 않는다. 스트리밍 `ai.planner.progress`에 generationId/tripId·responseId·phase·elapsedMs·completedSearches가 남고, 실패 details에는 timeoutMs·lastEventAgoMs도 남는다. timeout과 출력 한도 초과 output_limit은 일반 provider_failure와 구분한다. ai.planner.response에 상태·maxOutputTokens·usage·incompleteDetails를 기록한다. 기본 전체 제한 600000ms와 재시도 0회, 스트림 진행 중에도 전체 제한으로 중단, 실패 사유 전달과 타이머 정리를 모킹/가짜 시계로 검증한다.

## 날짜별 시간표 실생성 확인 기록

2026-11-17에 공개 합성 파리 조건(2026-12-15~21, Hotel du Louvre·공항 경계)으로 gpt-5-mini를 테스트했다. 개인 여행 DB는 읽거나 변경하지 않았으며 입력·출력은 /tmp에만 저장했다. 최종 프롬프트 v16의 등록 장소 없는 7일 응답은 7일·33방문(약 109초), 중간 하루 업데이트는 1일·7방문(약 58초)이었다. 후자는 등록된 루브르 ID와 신규 방문을 같은 배열로 반환하고 09:30부터 계획했다. 초기 v15의 7일·하루 각 한 번을 포함해 총 4회 호출이다. 이는 실제 모델이 새 스키마를 받아 빈 결과 대신 날짜별 시간표를 반환하는지 확인한 표본이며 방문 개수 목표나 품질 통과 기준이 아니다. 주간 표본에는 휴업 시설·여러 명소를 묶은 이름·긴 공백이 남아 있어 실제 운영정보 검증과 일정 품질까지 해결됐다는 근거로 사용하지 않는다.

## Maestro 핵심 흐름

`.maestro/core-flow.yml`은 개발 로그인 → 여행 생성 → 장소 검색·저장 → AI 일정 → 일정 저장 → 별점 → 완료 기록을 검증한다. 앱 내부 패키지나 테스트 전용 백도어 없이 Development Build의 접근성 트리를 조작한다.

사전 조건:

- PostgreSQL과 NestJS API가 실행 중이어야 한다.
- `AUTH_MODE=development`, `MAPS_PROVIDER=mock`, `AI_PLANNER_PROVIDER=mock`을 사용한다.
- 테스트 대상 Simulator/Emulator에 Development Build가 설치되어 있어야 한다.
- Maestro CLI가 설치되어 있어야 한다.

iOS Simulator에서는 API와 Metro를 다음처럼 실행한다.

```bash
pnpm db:up
pnpm --filter @tripus/api migration:run
pnpm --filter @tripus/api dev
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 pnpm --filter @tripus/mobile start
```

Metro 터미널에 표시되는 development server URL을 넘겨 테스트한다. URL에 `&` 같은 셸 특수 문자가 있으면 따옴표로 감싼다.

```bash
EXPO_DEV_SERVER_URL=http://127.0.0.1:8081 pnpm e2e:maestro
```

Android Emulator에서는 API 주소가 `http://10.0.2.2:3000`, Metro 주소가 일반적으로 `http://10.0.2.2:8081`이다.

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 pnpm --filter @tripus/mobile start
maestro test --udid emulator-5554 -e EXPO_DEV_SERVER_URL=http://10.0.2.2:8081 .maestro/core-flow.yml
```

Android 37 Emulator에서 스타일러스 필기 패널이 자동 입력을 가로채면 테스트 기기의 필기 입력만 끈 뒤 다시 실행한다.

```bash
adb -s emulator-5554 shell settings put secure stylus_handwriting_enabled 0
```

테스트는 앱 데이터와 iOS 키체인을 초기화하므로 개인 개발 계정 상태가 있는 기기에서는 실행하지 않는다.

Maestro가 설치되지 않은 환경의 일반 CI에서는 Jest 테스트까지만 실행한다. 로컬 Development Build에서 동일 flow의 iOS·Android 통과를 확인했으며, EAS 도입 시 두 플랫폼 빌드에 연결한다.
