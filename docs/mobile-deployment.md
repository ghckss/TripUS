# 모바일 배포

TripUS 모바일은 로컬 Development Build를 기본 개발 방식으로 유지하고, 팀 내부 배포부터 EAS Build를 사용한다.

## 최초 1회 연결

Expo 계정 소유자가 아래 명령으로 프로젝트를 연결한다. 이 단계에서 생성되는 EAS project ID는 Expo 프로젝트의 공개 식별자이며 앱 설정에 기록된다.

```bash
pnpm --filter @tripus/mobile exec eas login
pnpm --filter @tripus/mobile exec eas project:init
```

EAS의 `development`, `preview`, `production` 환경마다 다음 변수를 설정한다. `EXPO_PUBLIC_` 값은 앱 번들에 포함되므로 비밀 값을 넣지 않는다.

| 변수 | development | preview / production |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | 개발 Web Function endpoint 또는 로컬 접근 URL | 해당 환경의 HTTPS Web Function endpoint |
| `EXPO_PUBLIC_AUTH_MODE` | `development` | `production` |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | 개발용 iOS OAuth Client ID | 배포용 iOS OAuth Client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | 개발용 Android OAuth Client ID | 배포용 Android OAuth Client ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 개발용 Web OAuth Client ID | 배포용 Web OAuth Client ID |
| `GOOGLE_MAPS_IOS_API_KEY` | 개발 iOS 앱 제한 Maps SDK 키 | 배포 iOS 앱 제한 Maps SDK 키 |
| `GOOGLE_MAPS_ANDROID_API_KEY` | 개발 Android 앱 제한 Maps SDK 키 | 배포 Android 앱 제한 Maps SDK 키 |

값은 Expo 대시보드 또는 `eas env:create`로 관리한다. Maps SDK 키는 최종 앱 바이너리에 포함되는 플랫폼 자격 증명이므로 각 앱 식별자와 SDK로 제한한다. OAuth client secret, OpenAI 키, 서버용 Google Maps 키, AWS 키는 모바일 환경에 넣지 않고 API 런타임에서만 관리한다.

## 빌드 프로필

- `development`: Development Client를 포함한 팀 내부 설치 빌드
- `preview`: QA용 내부 배포 빌드
- `production`: 스토어 제출용 빌드 번호 자동 증가 빌드

로컬에서는 `pnpm --filter @tripus/mobile eas:build:preview`처럼 실행한다. GitHub Actions의 `Mobile EAS Build`는 수동 실행으로 프로필과 플랫폼을 선택한다. GitHub Environment마다 `EXPO_TOKEN` secret을 등록해야 하며, EAS 환경 변수는 Expo에서 관리한다.

스토어 제출 전에는 Expo 계정에서 Apple App Store Connect와 Google Play 서비스 계정 자격 증명을 연결한 뒤 `pnpm --filter @tripus/mobile eas:submit`을 실행한다.
