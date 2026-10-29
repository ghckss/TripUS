# TripUS AWS 배포 가이드

## 범위

현재 CDK 구성은 서울 리전(`ap-northeast-2`)을 기본으로 NestJS API와 데이터 계층을 배포한다.

```text
React Native
  -> Lambda Web Function endpoint
     -> NestJS API (Node.js 24, arm64)
        -> RDS Proxy -> Aurora PostgreSQL Serverless v2
        -> S3 원본/파생 사진
        -> Secrets Manager
```

`dev`는 mock AI·지도와 development 인증이 기본이다. 외부에 공개하는 운영 환경에는 반드시 `prod`, JWT 인증, 실제 공급자 키를 사용한다.

## 사전 조건

- Node.js 22.13 이상, pnpm 11.11
- AWS CLI v2와 배포 계정 자격 증명
- AWS CDK bootstrap 권한
- 로컬 `zip` 명령

배포 계정과 서울 리전을 확인한다.

```bash
aws sts get-caller-identity
aws configure get region
```

리전이 비어 있거나 다르면 현재 셸에 `AWS_REGION=ap-northeast-2`와 `CDK_DEFAULT_REGION=ap-northeast-2`를 설정한다. 장기 액세스 키를 저장소 `.env`에 넣지 않는다.

## 로컬 검증과 최초 bootstrap

```bash
pnpm install --frozen-lockfile
pnpm deploy:synth
pnpm deploy:bootstrap
```

`deploy:synth`는 API를 빌드하고 운영 의존성 및 Linux arm64 Sharp 바이너리를 zip으로 만든 뒤, CDK strict validation과 `cdk-nag` 검사를 수행한다.

## 개발 환경 배포

변경 사항과 IAM 확장을 먼저 확인한다.

```bash
pnpm deploy:diff -- --context stage=dev
pnpm deploy:aws -- --context stage=dev
```

배포 중 다음 작업이 자동으로 실행된다.

1. 상태 저장 스택을 먼저 생성한다.
2. API zip을 전용 버전 관리 S3 버킷에 업로드한다.
3. 배포 전용 Lambda가 TypeORM migration을 트랜잭션으로 적용한다.
4. migration 성공 후에만 새 Web Function revision과 endpoint를 활성화한다.

출력된 `ApiEndpointDomain`에 `https://`를 붙여 모바일의 `EXPO_PUBLIC_API_URL`로 사용한다. `/v1/health`로 상태를 확인한다.

## 운영 환경 배포

운영은 데이터 스택과 API 스택을 나누어 배포한다. 먼저 비밀 저장소를 만든다.

```bash
pnpm --filter @tripus/infra package:api
pnpm --filter @tripus/infra exec cdk deploy TripUs-prod-Data --context stage=prod --require-approval broadening
```

CloudFormation 출력의 `RuntimeSecretArn`을 AWS Secrets Manager 콘솔에서 열고 기존 JSON을 유지하면서 아래 값을 추가한다.

```json
{
  "OPENAI_API_KEY": "...",
  "OPENAI_MODEL": "...",
  "GOOGLE_MAPS_API_KEY": "...",
  "GOOGLE_OIDC_CLIENT_IDS": "...",
  "APPLE_OIDC_CLIENT_IDS": "..."
}
```

키를 셸 명령 기록, CDK context, GitHub Actions 변수 또는 CloudFormation template에 넣지 않는다. 비밀값을 채운 다음 API 스택을 배포한다.

```bash
pnpm --filter @tripus/infra exec cdk deploy TripUs-prod-Api --context stage=prod --require-approval broadening
```

운영 endpoint를 앱에 넣기 전 로그인, 장소 검색, AI 일정, 사진 업로드와 migration 로그를 확인한다. 현재 사용자 지정 도메인, CloudFront와 WAF는 후속 운영 보강 범위다.

## 비용과 삭제 보호

실제 요청이 없어도 Aurora 최소 용량, RDS Proxy, Secrets Manager와 인터페이스 endpoint에는 비용이 발생한다. 실제 OpenAI·Google·JWT 모드를 사용하면 NAT Gateway도 생성되어 시간당 및 처리량 비용이 추가된다. 배포 전 AWS Budgets 알림을 설정한다.

Aurora와 S3 버킷은 보존 정책을 사용하고 DB 삭제 보호를 켠다. 따라서 `cdk destroy`만으로 상태 데이터가 삭제되지 않는다. 환경 폐기는 백업과 보존 여부를 먼저 결정한 별도 변경으로 수행한다.

## 장애 확인 순서

1. CloudFormation의 실패 이벤트를 확인한다.
2. `MigrationFunction` 로그에서 TypeORM migration 결과를 확인한다.
3. Web Function application/system 로그에서 부팅 오류를 확인한다.
4. runtime secret에 선택한 공급자의 필수 키가 모두 있는지 확인한다.
5. RDS Proxy와 Aurora 상태, VPC 보안 그룹을 확인한다.

비밀값은 로그나 이슈 본문에 복사하지 않는다.
