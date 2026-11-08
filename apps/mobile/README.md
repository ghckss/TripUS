# TripUS Mobile

Expo SDK 58과 React Native로 만든 TripUS Development Build다. 화면과 도메인 로직은 `src/domains`에, Expo Router 진입점은 `src/app`에 둔다.

## 로컬 실행

루트에서 의존성과 모바일 환경 변수를 준비한 뒤 실행한다.

```bash
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @tripus/mobile ios
```

iOS Simulator가 호스트의 로컬 API에 연결할 때 `EXPO_PUBLIC_API_URL`은 `http://127.0.0.1:3000`을 사용한다. 전체 환경 변수는 `../../docs/environment.md`를 참고한다.

## iOS 네이티브 프로젝트 복구

`ios` 디렉터리는 CNG가 생성하며 Git에서 추적하지 않는다. Expo 또는 React Native 의존성이 바뀐 뒤 CocoaPods가 오래된 `Podfile.lock`을 갱신하느라 첫 실행이 오래 걸릴 수 있다. 진행 상황을 포함해 완전히 다시 생성하려면 다음 명령을 사용한다.

```bash
pnpm --filter @tripus/mobile ios:reset
```

이 명령은 iOS 생성 산출물을 지우고 `app.json`과 config plugin에서 재생성한 뒤, Pod 설치를 중복 실행하지 않고 Simulator 빌드를 시작한다. 네이티브 변경은 `ios` 내부가 아니라 앱 설정 또는 config plugin에 반영한다.

## 품질 검사

```bash
pnpm --filter @tripus/mobile typecheck
pnpm --filter @tripus/mobile lint
pnpm --filter @tripus/mobile test
```
