# AWS EKS 배포 가이드 (Docker + Kubernetes)

## 앱 특성

- 순수 프론트엔드 (localStorage, 백엔드 없음) → Stateless
- 환경변수: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` 하나 (빌드 타임에 바인딩됨)

---

## 전체 아키텍처

```
[로컬 빌드]
  docker build → ECR push
       ↓
[AWS 인프라]
  ECR (이미지 저장소)
       ↓
  EKS Cluster
  └── Node Group (EC2)
       └── Pod × 2 (Next.js 컨테이너)
            ↓
       Service (LoadBalancer)
            ↓
       AWS ALB → 외부 트래픽
```

---

## 생성 파일 목록

| 파일 | 설명 |
|------|------|
| `Dockerfile` | 멀티스테이지 빌드 (node:20-alpine) |
| `.dockerignore` | 불필요한 파일 제외 |
| `next.config.ts` | `output: 'standalone'` 추가 |
| `k8s/deployment.yaml` | 2 replica Pod 정의 |
| `k8s/service.yaml` | LoadBalancer Service |

---

## 1. `next.config.ts` 수정

`output: 'standalone'` 추가 → Docker 이미지 최소화

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
}
```

---

## 2. `Dockerfile` (멀티스테이지)

```dockerfile
# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
RUN npm run build

# Stage 3: 실행 (standalone 모드)
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

> **빌드 타임 바인딩 이유:** `NEXT_PUBLIC_` 접두사 변수는 Next.js가 빌드 시 번들에 인라인함.
> K8s Secret/ConfigMap으로 런타임 주입 불가 → Docker build ARG로 전달.

---

## 3. `.dockerignore`

```
.next
node_modules
.env*
*.md
.git
```

---

## 4. `k8s/deployment.yaml`

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tripus
spec:
  replicas: 2
  selector:
    matchLabels:
      app: tripus
  template:
    metadata:
      labels:
        app: tripus
    spec:
      containers:
        - name: tripus
          image: <AWS_ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/tripus:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
```

---

## 5. `k8s/service.yaml`

```yaml
apiVersion: v1
kind: Service
metadata:
  name: tripus
spec:
  type: LoadBalancer
  selector:
    app: tripus
  ports:
    - port: 80
      targetPort: 3000
```

---

## 배포 단계별 명령어

### 사전 준비

```bash
# AWS CLI, kubectl, eksctl 설치 확인
aws configure   # Access Key, Secret, Region 설정
```

### Step 1: ECR 저장소 생성

```bash
aws ecr create-repository --repository-name tripus --region ap-northeast-2
```

### Step 2: Docker 빌드 & ECR Push

```bash
# ECR 로그인
aws ecr get-login-password --region ap-northeast-2 \
  | docker login --username AWS --password-stdin \
    <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com

# 빌드 (API 키를 build arg로 주입)
docker build \
  --build-arg NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<YOUR_KEY> \
  -t tripus .

# 태그 & 푸시
docker tag tripus:latest <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tripus:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/tripus:latest
```

### Step 3: EKS 클러스터 생성 (eksctl)

```bash
eksctl create cluster \
  --name tripus-cluster \
  --region ap-northeast-2 \
  --nodegroup-name tripus-nodes \
  --node-type t3.small \
  --nodes 2 \
  --managed
# ⚠ 약 15~20분 소요
```

### Step 4: kubectl 설정

```bash
aws eks update-kubeconfig --name tripus-cluster --region ap-northeast-2
kubectl get nodes  # 노드 확인
```

### Step 5: K8s 매니페스트 적용

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 배포 확인
kubectl get pods
kubectl get service tripus  # EXTERNAL-IP 확인 (ALB 주소)
```

---

## 검증

1. `kubectl get pods` → 2개 Running 상태
2. `kubectl get service tripus` → EXTERNAL-IP 할당 확인
3. 브라우저에서 `http://<EXTERNAL-IP>` 접속 → 앱 정상 로드
4. 지도 표시 확인 (Google Maps API 키 정상 적용)

---

## 비용 참고 (ap-northeast-2 기준)

| 항목 | 비용 |
|------|------|
| EKS 클러스터 | ~$0.10/시간 |
| t3.small × 2 | ~$0.046/시간 |
| ALB | ~$0.023/시간 + 데이터 비용 |

> **테스트 후 반드시 삭제:** `eksctl delete cluster --name tripus-cluster`
