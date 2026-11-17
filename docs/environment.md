# 환경 변수 설정

TripUS의 환경 변수는 용도별로 세 파일에 둔다.

- 루트 `.env`: 로컬 PostgreSQL 컨테이너 전용
- `apps/api/.env`: NestJS API 전용이며 비밀값을 포함할 수 있음
- `apps/mobile/.env`: Expo 앱 전용이며 `EXPO_PUBLIC_` 값은 앱 번들에 공개됨

실제 `.env` 파일은 커밋하지 않는다. 최초에는 각 디렉터리의 `.env.example`을 복사한다.

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
```

## 로컬 개발 권장값

루트 `.env`는 Docker Compose가 읽는다.

```dotenv
POSTGRES_DB=tripus
POSTGRES_USER=tripus
POSTGRES_PASSWORD=tripus_local
POSTGRES_PORT=5432
```

`apps/api/.env`는 외부 API를 사용하지 않는 안전한 로컬 기본값이다.

```dotenv
PORT=3000
DATABASE_URL=postgresql://tripus:tripus_local@localhost:5432/tripus
DATABASE_POOL_MAX=4
DATABASE_CONNECTION_TIMEOUT_MS=5000
DATABASE_IDLE_TIMEOUT_MS=30000
DATABASE_STATEMENT_TIMEOUT_MS=15000

AI_PLANNER_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_MODEL=
OPENAI_TIMEOUT_MS=600000
OPENAI_MAX_RETRIES=0
OPENAI_MAX_OUTPUT_TOKENS=64000

MAPS_PROVIDER=mock
GOOGLE_MAPS_API_KEY=

PHOTO_STORAGE_PROVIDER=local
PHOTO_LOCAL_DIRECTORY=.data/photos
API_PUBLIC_URL=http://localhost:3000
PHOTO_S3_BUCKET=
AWS_REGION=ap-northeast-2
PHOTO_S3_ENDPOINT=

# 로컬 Plus 전환 테스트 전용. 배포 환경에서는 disabled를 사용한다.
BILLING_PROVIDER=mock

AUTH_MODE=development
ACCESS_TOKEN_SECRET=tripus-development-secret-change-me
ACCESS_TOKEN_ISSUER=tripus-api
ACCESS_TOKEN_AUDIENCE=tripus-mobile
GOOGLE_OIDC_CLIENT_IDS=
APPLE_OIDC_CLIENT_IDS=
```

`apps/mobile/.env`의 API URL은 실행 대상에 따라 달라진다.

| 실행 대상 | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| iOS Simulator | `http://127.0.0.1:3000` |
| Android Emulator | `http://10.0.2.2:3000` |
| iOS·Android 실기기 | `http://<개발 Mac의 LAN IP>:3000` |

나머지 모바일 로컬 값은 다음과 같다.

```dotenv
EXPO_PUBLIC_AUTH_MODE=development
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=

# Google Maps 네이티브 SDK용 CNG 빌드 변수
GOOGLE_MAPS_IOS_API_KEY=<iOS 앱 제한 키>
GOOGLE_MAPS_ANDROID_API_KEY=<Android 앱 제한 키>
```

`GOOGLE_MAPS_IOS_API_KEY`와 `GOOGLE_MAPS_ANDROID_API_KEY`는 JavaScript 번들에서 읽는 런타임 값이 아니라 CNG가 네이티브 프로젝트를 생성할 때 사용하는 빌드 값이다. 키를 바꾼 뒤에는 Metro 재시작만으로 반영되지 않으므로 Development Build를 다시 생성한다. iOS 키는 Bundle ID `com.tripus.app`, Android 키는 package name `com.tripus.app`과 배포 인증서 SHA-1로 제한하고 각 키에는 해당 플랫폼의 Maps SDK만 허용한다.

3000 포트를 다른 프로그램이 사용하면 API의 `PORT`와 `API_PUBLIC_URL`, 모바일의 `EXPO_PUBLIC_API_URL`을 같은 포트로 함께 바꾼다. 예를 들어 API는 `3001`, iOS Simulator는 `http://127.0.0.1:3001`, Android Emulator는 `http://10.0.2.2:3001`을 사용한다.

## 실제 외부 서비스 활성화

`BILLING_PROVIDER=mock`은 스토어 결제 없이 Plus 권한 전환 흐름을 확인하는 로컬 테스트 전용 값이다. 기본값과 AWS 배포값은 `disabled`이며, 실제 출시 전 App Store·Google Play 영수증 검증 공급자로 교체해야 한다.

OpenAI 일정 생성을 켤 때는 API에만 다음 값을 둔다. `OPENAI_API_KEY`를 모바일 환경 변수에 넣으면 안 된다.

```dotenv
AI_PLANNER_PROVIDER=openai
OPENAI_API_KEY=<OpenAI 프로젝트 API 키>
OPENAI_MODEL=<사용할 Responses API 지원 모델 ID>
```

Google 장소·경로 어댑터를 켤 때 서버용 키는 API에만 둔다.

```dotenv
MAPS_PROVIDER=google
GOOGLE_MAPS_API_KEY=<서버용 Google Maps Platform API 키>
```

앱 내부 Google 지도는 서버 어댑터와 별개다. 모바일 CNG 빌드에는 플랫폼별 Maps SDK 키가 필요하고, 서버의 Places/Routes 키를 재사용하지 않는다.

소셜 로그인을 켤 때 모바일에는 플랫폼별 공개 OAuth Client ID를, API에는 허용할 Client ID 전체를 쉼표로 구분해 둔다.

```dotenv
# apps/mobile/.env
EXPO_PUBLIC_AUTH_MODE=production
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS OAuth Client ID>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Android OAuth Client ID>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Web OAuth Client ID>

# apps/api/.env 또는 AWS Secrets Manager
AUTH_MODE=jwt
GOOGLE_OIDC_CLIENT_IDS=<iOS ID>,<Android ID>,<Web ID>
APPLE_OIDC_CLIENT_IDS=<Apple Service ID 또는 Bundle ID>
ACCESS_TOKEN_SECRET=<32자 이상의 무작위 비밀값>
```

Google 로그인은 네이티브 Google Sign-In SDK를 사용한다. Google Cloud의 OAuth 클라이언트는 다음 세 종류를 각각 만들어야 한다.

- Android: package name `com.tripus.app`과 현재 빌드 인증서의 SHA-1 등록
- iOS: Bundle ID `com.tripus.app` 등록
- Web application: 모바일에서 발급받을 ID 토큰의 audience로 사용

OAuth 동의 화면이 `External · Testing` 상태라면 실제 로그인에 사용할 Google 계정을 Auth Platform의 테스트 사용자에 추가한다. Android OAuth 클라이언트의 SHA-1은 개발 빌드와 Play 배포 빌드가 서로 다를 수 있으므로 각각 등록한다.

Google 로그인 SDK와 iOS URL Scheme은 네이티브 빌드에 포함된다. Client ID를 처음 설정하거나 로그인 SDK 구성을 변경한 뒤에는 Metro만 다시 시작하지 말고 네이티브 프로젝트와 Development Build를 다시 생성한다.

```bash
pnpm --filter @tripus/mobile prebuild:ios
pnpm --filter @tripus/mobile ios
pnpm --filter @tripus/mobile android
```

Apple 로그인에는 별도 모바일 비밀값이 필요하지 않으며 앱의 Bundle ID와 Apple Developer 설정이 일치해야 한다.

## AWS 배포

배포 환경에서는 데이터베이스 URL, 버킷 이름과 공개 API URL을 CDK가 주입한다. OpenAI 키, Google Maps 키, OIDC Client ID 같은 비밀값은 CDK가 생성한 런타임 Secrets Manager secret에 저장한다. 모바일 배포 빌드에는 아래 공개값만 설정한다.

```dotenv
EXPO_PUBLIC_API_URL=https://<배포된 Lambda Web Function endpoint 도메인>
EXPO_PUBLIC_AUTH_MODE=production
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<iOS OAuth Client ID>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<Android OAuth Client ID>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<Web OAuth Client ID>
GOOGLE_MAPS_IOS_API_KEY=<iOS 앱 제한 Maps SDK 키>
GOOGLE_MAPS_ANDROID_API_KEY=<Android 앱 제한 Maps SDK 키>
```

운영 `ACCESS_TOKEN_SECRET`은 `openssl rand -base64 48` 같은 방식으로 새로 생성하고 로컬 기본값을 재사용하지 않는다. 자세한 secret 등록과 Lambda 배포 순서는 [AWS 배포 가이드](./aws-deployment.md)를 따른다.
