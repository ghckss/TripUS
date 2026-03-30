# Tripus - 여행 기록 앱

사용자가 여행한 장소를 검색하고, GPS 위치 기반으로 사진을 촬영하여 여행 기록을 남기는 웹 애플리케이션입니다. 시간순으로 연결된 여행 경로를 지도에서 시각적으로 확인할 수 있습니다.

## 주요 기능

- 🔍 **장소 검색**: Google Places API를 활용한 실시간 장소 검색
- 📷 **GPS 사진 촬영**: 현재 위치 정보가 포함된 사진 촬영
- 📝 **여행 기록 작성**: 사진과 함께 여행 기록 및 느낌 작성
- 🗺️ **경로 시각화**: 시간순으로 방문한 장소들을 지도에 연결하여 표시
- 💾 **로컬 저장**: 브라우저 LocalStorage를 활용한 데이터 저장

## 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **스타일링**: Tailwind CSS
- **지도**: Google Maps JavaScript API
- **위치 서비스**: Web Geolocation API
- **이미지 처리**: EXIF.js (GPS 메타데이터 추출)
- **상태 관리**: React Context API

## 설치 및 실행

### 1. 의존성 설치

```bash
npm install
```

### 2. Google Maps API 키 설정

`.env` 파일을 생성하고 Google Maps API 키를 설정합니다:

```bash
cp .env.example .env
```

`.env` 파일에서 API 키를 설정:
```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

### 3. Google Maps API 설정

Google Cloud Console에서 다음 API들을 활성화해야 합니다:
- Maps JavaScript API
- Places API
- Geocoding API

### 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

## 사용 방법

### 1. 새 여행 시작
- "새 여행 시작하기" 버튼을 클릭하여 여행 이름을 입력합니다.

### 2. 여행 기록 추가
- "첫 기록 추가하기" 또는 "새 기록 추가" 버튼을 클릭합니다.
- 제목을 입력하고 장소를 검색하여 선택합니다.
- "사진 촬영" 버튼을 눌러 현재 위치에서 사진을 촬영합니다.
- 여행 기록이나 느낌을 자유롭게 작성합니다.
- "기록 저장" 버튼을 클릭하여 저장합니다.

### 3. 여행 경로 확인
- 대시보드에서 지도를 통해 시간순으로 연결된 여행 경로를 확인할 수 있습니다.
- 지도의 마커를 클릭하면 해당 장소의 상세 정보를 볼 수 있습니다.

### 4. 여행 관리
- 헤더의 드롭다운에서 다른 여행으로 전환할 수 있습니다.
- "새 여행" 버튼으로 새로운 여행을 시작할 수 있습니다.

## 프로젝트 구조

```
src/
├── components/          # React 컴포넌트
│   ├── LocationSearch.tsx    # 장소 검색 컴포넌트
│   ├── PhotoCapture.tsx      # 사진 촬영 컴포넌트
│   ├── TravelMap.tsx         # 지도 시각화 컴포넌트
│   └── TravelRecordForm.tsx  # 여행 기록 작성 폼
├── contexts/           # React Context
│   └── TravelContext.tsx     # 여행 데이터 관리
├── hooks/              # Custom Hooks
│   └── useGoogleMaps.ts      # Google Maps 초기화 훅
├── types/              # TypeScript 타입 정의
│   └── index.ts             # 공통 타입 정의
├── utils/              # 유틸리티 함수
│   └── maps.ts              # 지도 관련 유틸리티
└── App.tsx             # 메인 앱 컴포넌트
```

## 브라우저 지원

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

위치 서비스와 카메라 접근을 위해 HTTPS 환경에서 사용하는 것을 권장합니다.

## 개발

### 빌드

```bash
npm run build
```

### 린트

```bash
npm run lint
```

### 프리뷰

```bash
npm run preview
```

## 라이선스

MIT License