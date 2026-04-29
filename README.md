# judojoo-app — 주도주 눌림매매 백테스트 인터랙티브 앱

> NEO-SCORE 스타일 백테스트 분석 앱. 6년치 933개 진입 trades 데이터로 실시간 필터/TP·SL 시뮬레이션.
> **NEO-SCORE와 별개 프로젝트** — 데이터 source만 historical reference.

---

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 개발 서버 (localhost:5173)
npm run dev

# 3. 프로덕션 빌드
npm run build
# → dist/ 폴더 생성

# 4. 미리보기
npm run preview
```

## 📊 주요 기능

### 1. 필터 (8가지 차원)

| 차원 | 옵션 |
|---|---|
| **기간** | 전체 / 21~26년 + 날짜 범위 |
| **주도주성** (6년 시그널) | 21회+ / 11-20 / 6-10 / 3-5 / 1-2 |
| **수급** | 기+외 / 외만 / 기만 / 둘다- |
| **신고가** | 120일↑ / 60일만 / 없음 |
| **진입 패턴** | 5일선 돌파 / 5일선 지지 / 20일선 반등 |
| **등락률** | 13~16% (골든존) / 16~20 / 20~25 / 25%+ |
| **거래대금** | 5000억+ / 2000~5000 / 1000~2000 |
| **시장** | KOSDAQ / KOSPI |
| **월 제외** | 1~12월 다중 선택 |

### 2. TP/SL 패널

- **단일 TP 모드**: TP / SL / 최대 보유일
- **분할 TP 모드**: TP1 (절반 익절) → TP2 (잔량 익절), 본전보장(fSL) 옵션
- **🔍 수익MAX 자동**: 그리드 서치로 최적 TP/SL 자동 적용
- **⭐ 권장값**: 1차 백테스트 결과 (TP70/SL-10) 적용

### 3. 통계 카드 (실시간)

- 진입 건수 / 누적 수익률 (50만원 가정 원화)
- 평균 EV / 승률 / TP·SL·만료 분포

### 4. 분석 차원

- **연도별 / 월별** 통계 (계절성 확인)
- **종목별 TOP 30** (누적 수익률 순)

### 5. 트레이드 테이블

- 12 컬럼 (시그널일/종목/시장/시그널 빈도/등락률/거래대금/수급/h120/패턴/D후/진입가/결과)
- **모든 컬럼 정렬 가능** (클릭)
- **행 클릭 시 펼침** — 진입 후 OHLC 추이 (10일치)
- 페이지네이션 (20건/page)

## 🎯 디폴트 룰 (1차 백테스트 권장)

```javascript
// 디폴트 매매 룰
{
  mode: "single",
  tp: 70,        // +70% 익절
  sl: -10,       // -10% 손절
  maxDays: 20,   // 최대 20영업일 보유
}
```

**베이스 셋 (필터: 21회+ AND 120일 신고가)**:
- 표본 271건 / 월평균 3.8건
- EV +2.32% / 승률 21.8%
- 누적 +629% (50만원 = +314만원)

## 🛠 기술 스택

- **React 18** + Vite 5 (빌드 도구)
- **외부 의존성**: react, react-dom (그게 전부)
- **데이터**: trades.json (2MB, 933 entries × OHLC 60일)

## 📁 구조

```
judojoo-app/
├── package.json
├── vite.config.js
├── vercel.json              # Vercel 배포 설정
├── index.html
└── src/
    ├── main.jsx
    ├── App.jsx              # 메인 컴포넌트
    ├── data/
    │   └── trades.json      # 933 trades 백테스트 데이터
    ├── lib/
    │   ├── simulator.js     # TP/SL 시뮬 + 그리드 서치
    │   └── filters.js       # 필터 + 정렬 + 그룹핑
    └── components/
        ├── FilterBar.jsx        # 8 필터 차원
        ├── TPSLPanel.jsx        # TP/SL + 자동 최적화
        ├── StatsCards.jsx       # 7 통계 카드
        ├── YearMonthBreakdown.jsx  # 연도/월/종목 분석
        └── TradesTable.jsx      # 메인 테이블 + 디테일
```

## 🚢 Vercel 배포

```bash
# 1. GitHub repo 생성 후 푸시
git init
git add .
git commit -m "judojoo-app v0.1.0"
git remote add origin https://github.com/neo9999999999/judojoo-app.git
git push -u origin main

# 2. Vercel 연결
# https://vercel.com → New Project → GitHub repo 선택
# Build command: npm run build (자동 감지)
# Output dir: dist (자동 감지)
```

또는 GitHub Pages:
```bash
npm run build
# dist/ 폴더를 gh-pages 브랜치에 푸시
```

## 🔄 데이터 갱신

`src/data/trades.json`을 새 백테스트 결과로 교체하면 앱 자동 갱신.

새 데이터 생성 (judojoo Python 패키지 사용):
```python
from judojoo.kis import from_env, KisClient, fetch_stock_history
# ... KIS API로 일봉 수집
# 백테스트 → trades.json 생성 (judojoo backtest 스크립트 따로 작성)
```

## 📈 검증된 결과

Python 백테스트와 JavaScript 시뮬레이터 결과 **100% 일치 검증 완료**:

```
필터: 21회+ AND 120일 신고가
TP 70 / SL -10 / 최대 20일

표본: 271건
EV: +2.32%
승률: 21.8%
누적: +629%
TP 도달: 11.4%
SL 손절: 75.6%
```

## 🚧 향후 개선

- [ ] OHLC 차트 시각화 (디테일 행에서)
- [ ] 매매일지 자동 기록 (선택한 trade)
- [ ] 외부 API 연동 (실시간 시그널 자동 추가)
- [ ] 모바일 UX 최적화

---

*v0.1.0 / 2026-04-29 / 매매법 마스터 v3 + 1차 백테스트 결과 기반*
