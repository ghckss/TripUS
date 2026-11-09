# TripUS

TripUS는 Expo React Native 모바일 앱과 독립 NestJS API로 구성된 여행 계획·기록 서비스다. pnpm 모노레포에서 PostgreSQL, TypeORM, OpenAPI 생성 클라이언트를 함께 관리한다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
pnpm db:up
pnpm --filter @tripus/api migration:run
pnpm --filter @tripus/api dev
```

다른 터미널에서 Development Build용 Metro를 실행한다.

```bash
pnpm --filter @tripus/mobile start
```

Android Emulator에서 API 주소를 명시하려면 다음처럼 실행한다.

```bash
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 pnpm --filter @tripus/mobile start
```

Development Build를 새로 만들 때 Codex나 GUI에서 시작한 셸이 Android 환경 변수를 상속하지 않았다면 SDK 경로를 명시한다.

```bash
ANDROID_HOME="$HOME/Library/Android/sdk" \
ANDROID_SDK_ROOT="$HOME/Library/Android/sdk" \
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000 \
pnpm --filter @tripus/mobile android
```

iOS Simulator용 Google 지도 로컬 빌드는 다음과 같다. 플랫폼 키가 없는 빌드에서는 Google iOS SDK가 포함되지 않으므로 `.env`에 키를 설정한 뒤 Development Build를 새로 만든다.

```bash
GOOGLE_MAPS_IOS_API_KEY=<iOS 앱 제한 키> \
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 \
pnpm --filter @tripus/mobile ios
```

Expo 또는 React Native 버전을 변경한 뒤 CocoaPods 동기화가 오래 걸리거나 네이티브 빌드가 실패하면 CNG 산출물을 다시 생성한다. `apps/mobile/ios`는 생성 파일이므로 직접 수정하지 않는다.

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 pnpm --filter @tripus/mobile ios:reset
```

AI 일정은 기본적으로 결정적 목업을 사용한다. 실제 OpenAI 어댑터는 서버 환경에 `AI_PLANNER_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정했을 때 활성화된다.

지도 검색과 대중교통은 기본 목업이며 서버의 `MAPS_PROVIDER=google`과 `GOOGLE_MAPS_API_KEY`로 Google 어댑터를 활성화한다. 앱 내부 실제 Google 지도에는 별도의 `GOOGLE_MAPS_IOS_API_KEY`, `GOOGLE_MAPS_ANDROID_API_KEY`가 필요하다. 사진은 기본적으로 `.data/photos`에 저장한다. 운영 S3 호환 저장소는 `PHOTO_STORAGE_PROVIDER=s3`, `PHOTO_S3_BUCKET`, `AWS_REGION`을 설정한다. 원본 사진은 사용자별 총량 제한 없이 보존하되 파일당 100MB 안전 제한을 적용한다.

소셜 인증 운영 모드는 `AUTH_MODE=jwt`와 Google·Apple Client ID 설정이 필요하다. 로컬에서는 `AUTH_MODE=development`의 개발용 로그인을 사용한다. 실행 대상별 모바일 API 주소와 서버의 전체 설정값은 [환경 변수 설정](./docs/environment.md)을 참고한다.

## 품질 검사

```bash
pnpm contracts:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

제품 결정과 아키텍처는 [docs/README.md](./docs/README.md)에서 확인한다.

## AWS 배포

API 배포 구성은 AWS CDK로 관리한다. 로컬에서 API 산출물과 CloudFormation template을 검증하려면 다음을 실행한다.

```bash
pnpm deploy:synth
```

실제 계정 bootstrap, 개발/운영 배포 순서와 비용 주의점은 [AWS 배포 가이드](./docs/aws-deployment.md)를 따른다.

배포된 공개 endpoint의 DB readiness를 확인하려면 다음 smoke test를 실행한다.

```bash
pnpm deploy:smoke -- https://<ApiEndpointDomain>
```
