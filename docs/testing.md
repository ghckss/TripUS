# TripUS 테스트 가이드

## 자동 품질 검사

루트에서 아래 명령으로 API·모바일·인프라 테스트를 함께 실행한다.

```bash
pnpm test
```

모바일 테스트는 Expo SDK 58 기준의 Jest 30, `jest-expo`, React Native Testing Library 14를 사용한다. 사용자에게 보이는 결과와 접근성 역할을 우선 검증하고 구현 세부사항의 snapshot은 만들지 않는다.

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
