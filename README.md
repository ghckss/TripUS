# TripUS

TripUS는 Expo React Native 모바일 앱과 독립 NestJS API로 구성된 여행 계획·기록 서비스다. pnpm 모노레포에서 PostgreSQL, TypeORM, OpenAPI 생성 클라이언트를 함께 관리한다.

## 로컬 실행

```bash
pnpm install
cp .env.example .env
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

AI 일정은 기본적으로 결정적 목업을 사용한다. 실제 OpenAI 어댑터는 서버 환경에 `AI_PLANNER_PROVIDER=openai`, `OPENAI_API_KEY`, `OPENAI_MODEL`을 설정했을 때 활성화된다.

## 품질 검사

```bash
pnpm contracts:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

제품 결정과 아키텍처는 [docs/README.md](./docs/README.md)에서 확인한다.
