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

iOS Simulator용 로컬 빌드는 다음과 같다.

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000 pnpm --filter @tripus/mobile ios
```

AI 일정은 기본적으로 결정적 목업을 사용한다. 실제 OpenAI 어댑터는 서버 환경에 `AI_PLANNER_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정했을 때 활성화된다.

지도 검색과 대중교통은 기본 목업이며 `MAPS_PROVIDER=google`과 `GOOGLE_MAPS_API_KEY`로 Google 어댑터를 활성화한다. 사진은 기본적으로 `.data/photos`에 저장한다. 운영 S3 호환 저장소는 `PHOTO_STORAGE_PROVIDER=s3`, `PHOTO_S3_BUCKET`, `AWS_REGION`을 설정한다. 원본 사진은 사용자별 총량 제한 없이 보존하되 파일당 100MB 안전 제한을 적용한다.

소셜 인증 운영 모드는 `AUTH_MODE=jwt`와 Google·Apple Client ID 설정이 필요하다. 로컬에서는 `AUTH_MODE=development`의 개발용 로그인을 사용한다. 서버 환경 변수는 [apps/api/.env.example](./apps/api/.env.example), Docker Compose 변수는 루트 [.env.example](./.env.example)을 참고한다.

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
