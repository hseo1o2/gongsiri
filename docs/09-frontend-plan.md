# 09. Frontend Plan — 공시리

> 스택: Next.js 14 App Router + Tailwind CSS
> 디자인 SoT: `docs/08-design-system.md` + `assets/gongsiri_main_dashboard.html`
> 기능 SoT: `docs/05-feature-spec.md`

---

## 팀원별 프론트 담당

| 담당 | 구현 범위 | 근거 |
|------|----------|------|
| **C** | 공통 레이아웃, Auth, 대시보드, 워치리스트, 공시 알림, 포트폴리오, 설정, API Route Handlers, DB 연동 | 오케스트레이션 전체 |
| **B** | 리포트 상세, Q&A 페이지, 분석 관련 UI 컴포넌트 (ChecklistPanel · RiskBadge · ReportSection) | 분석 산출물 직접 소유 |
| **A** | 종목 검색 UI (SearchInput + 결과 목록), 워치리스트 AddStockModal | k-skill 연동 직접 소유 |

> 원칙: 각자 백엔드 산출물을 직접 소비하는 UI를 담당. C가 레이아웃·라우팅 셸 먼저 완성하면 A·B가 병렬로 컴포넌트 작업.

---

## 기술 스택

| 항목 | 선택 |
|------|------|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + CSS Variables (`docs/08-design-system.md`) |
| 폰트 | Bebas Neue · Noto Sans KR · IBM Plex Mono (Google Fonts) |
| 아이콘 | `@tabler/icons-react` |
| 상태관리 | Zustand |
| 서버통신 | fetch + React Query (캐싱·폴링) |
| 인증 | JWT — C 담당 |
| Markdown | `react-markdown` — 리포트 렌더링 |

---

## 페이지 구조 + 담당자

```
app/
├── (auth)/
│   ├── login/page.tsx              # [C] AUTH-01
│   └── signup/page.tsx             # [C] AUTH-01
├── (app)/
│   ├── layout.tsx                  # [C] Sidebar + AgentStatusBar 공통 셸
│   ├── onboarding/page.tsx         # [C] ON-01
│   ├── dashboard/page.tsx          # [C] DASH-01
│   ├── watchlist/
│   │   ├── page.tsx                # [C] WL-01 목록
│   │   └── _components/
│   │       ├── SearchInput.tsx     # [A] STK-01 종목 검색
│   │       └── AddStockModal.tsx   # [A] 검색결과 → 종목 추가
│   ├── disclosures/page.tsx        # [C] 공시 알림 목록
│   ├── report/
│   │   ├── page.tsx                # [C] REP-03 리포트 목록
│   │   └── [corpCode]/
│   │       ├── page.tsx            # [B] REP-01·02·03 리포트 상세
│   │       └── _components/
│   │           ├── ChecklistPanel.tsx   # [B]
│   │           ├── ReportSection.tsx    # [B]
│   │           ├── WarningReport.tsx    # [B]
│   │           └── ChangeBanner.tsx     # [B] MEM-02
│   ├── qa/page.tsx                 # [B] QA-01
│   ├── portfolio/page.tsx          # [C] PF-01 · DASH-02
│   └── settings/page.tsx           # [C]
└── api/                            # [C] Next.js Route Handlers
    ├── auth/[...]/route.ts
    ├── watchlist/route.ts
    ├── stocks/search/route.ts      # → A k-skill 프록시
    ├── pipeline/trigger/route.ts   # → B run_pipeline_request
    ├── report/[corpCode]/route.ts  # → B AnalysisResult 조회
    └── qa/route.ts                 # → B ask_qa
```

---

## C 담당 구현

### 공통 레이아웃 (`app/(app)/layout.tsx`)
```
AgentStatusBar    # 모니터링 상태 + 다음 폴링 시간 + "지금 체크" (ORCH-01)
Sidebar           # 네비게이션 + 알림 뱃지
```

**AgentStatusBar 동작**:
- "지금 체크" → `POST /api/pipeline/trigger` → ORCH-01
- 30분 폴링 카운트다운 표시 (ORCH-02)

---

### 대시보드 (`/dashboard`) — DASH-01

레이아웃: `assets/gongsiri_main_dashboard.html` 그대로

```
MetricRow (4개)         # 종목 수 · 신규 공시 · 주의 · 위험
WatchlistTable          # 종목 · 현재가 · 등락 · RiskBadge · 작전주 지수 바
AlertPanel              # 최근 공시 알림 (위험/주의/공시)
PortfolioRiskSummary    # 전체 위험도 바 + 안전/주의/위험 카운트
```

| 컴포넌트 | API |
|---------|-----|
| MetricRow | `GET /api/watchlist/summary` |
| WatchlistTable | `GET /api/watchlist` |
| AlertPanel | `GET /api/disclosures/recent` |
| PortfolioRiskSummary | `GET /api/portfolio/risk` |

---

### 워치리스트 (`/watchlist`) — WL-01

```
StockCard 그리드    # 등록 종목 목록 (RiskBadge 포함)
[A] SearchInput    # 종목 검색
[A] AddStockModal  # 종목 선택 → 등록 + 즉시 파이프라인 트리거
```

---

### 포트폴리오 (`/portfolio`) — PF-01 · DASH-02

```
PortfolioInputForm   # 종목·수량·매입가 입력
WeightedRiskBar      # 보유 비중 가중 위험도
HoldingRow 목록       # 종목별 리스크 점수
```

---

### API Route Handlers

| Route | 역할 |
|-------|------|
| `POST /api/pipeline/trigger` | `run_pipeline_request` 호출 → DB 저장 |
| `GET /api/watchlist` | DB에서 워치리스트 + 최신 risk_level 조회 |
| `GET /api/disclosures/recent` | 최근 공시 알림 조회 |
| `GET /api/portfolio/risk` | 보유 종목 가중 위험도 계산 |
| `GET /api/report/:corpCode/latest` | 최신 AnalysisResult 조회 |
| `GET /api/report/:corpCode/history` | 과거 리포트 목록 |
| `POST /api/qa` | `ask_qa` 호출 |
| `GET /api/stocks/search` | k-skill 종목 검색 프록시 |

---

## A 담당 구현

### 종목 검색 컴포넌트

**파일**: `app/(app)/watchlist/_components/SearchInput.tsx`
**파일**: `app/(app)/watchlist/_components/AddStockModal.tsx`

```
SearchInput
  - 입력 디바운스 300ms
  - GET /api/stocks/search?q={keyword} 호출
  - 결과: 종목명 · 종목코드 · 시장 목록

AddStockModal
  - SearchInput 포함
  - 종목 선택 → POST /api/watchlist
  - 등록 완료 시 즉시 파이프라인 트리거 표시
```

**A 백엔드 연결**:
```
/api/stocks/search → backend/collector/krx/search.py (k-skill)
                   → CompanyInfo { corp_name, stock_code, corp_code, market }
```

---

## B 담당 구현

### 리포트 상세 (`/report/[corpCode]`) — REP-01·02·03

**B 산출물 → UI 매핑**:

```
AnalysisResult.risk_level
  → RiskBadge (safe/caution/high)
  → 페이지 상단 헤더 색상 결정

AnalysisResult.checklist[]
  → ChecklistPanel (6행)
    .status          → 아이콘: ✓ #EAF3DE / ✗ #FCEBEB / – 회색
    .title           → 항목명
    .score           → 점수 표시
    .solar_explanation → 클릭 시 펼침 (accordion)
    .evidence[]      → 근거 태그 (Mono 스타일)

risk_level == "high"
  → WarningReport (단기·장기 리포트 영역 숨김)
  → short_term_report를 경고 리포트로 표시

risk_level in ("normal", "caution")
  → ShortTermReport (short_term_report Markdown)
  → LongTermReport  (long_term_report Markdown)

AnalysisResult.disclaimer
  → 하단 면책 문구 (caption 스타일)

ChangeBanner (MEM-02)
  → 직전 분석 대비 risk_score 상승 시 상단 배너
```

**컴포넌트 상세**:

```tsx
// ChecklistPanel — B가 구현
// props: checklist: ChecklistItem[]
// - status별 아이콘/색상은 docs/08-design-system.md 준수
// - solar_explanation accordion: 클릭 시 Solar 해석 텍스트 노출

// ReportSection — B가 구현
// props: title, content (Markdown string), variant: "short" | "long" | "warning"
// - react-markdown으로 렌더링

// RiskBadge — B가 구현 (재사용 컴포넌트로 ui/에 배치)
// props: level: "normal" | "caution" | "high"
// - normal  → "안전"  #EAF3DE/#3B6D11
// - caution → "주의"  #FAEEDA/#854F0B
// - high    → "위험"  #FCEBEB/#A32D2D
```

---

### Q&A (`/qa`) — QA-01

```
StockSelector       # 분석 완료 종목 선택 드롭다운
QuestionInput       # 질문 텍스트 입력
AnswerCard          # Solar 답변 출력 (Markdown)
EvidenceChips       # 공시 근거 태그
```

**API 연결**:
```
POST /api/qa
  body: { corpCode, question }
  response: { answer: string }
```

---

## 공통 컴포넌트 (B가 만들고 팀 전체 재사용)

```
components/ui/
├── RiskBadge.tsx          # [B] safe/caution/high
├── RiskProgressBar.tsx    # [B] 작전주 지수 4px 바 (0–6 스케일)
├── AlertCard.tsx          # [C] warn/danger 좌측 보더
├── StockCard.tsx          # [C] 종목 카드
├── MetricCard.tsx         # [C] 숫자 지표
├── Button.tsx             # [C] Primary / Secondary
└── SearchInput.tsx        # [A] 아이콘 포함 인풋 (워치리스트용)

components/report/         # [B]
├── ChecklistPanel.tsx
├── ChecklistRow.tsx
├── ReportSection.tsx
├── WarningReport.tsx
└── ChangeBanner.tsx

components/layout/         # [C]
├── Sidebar.tsx
├── AgentStatusBar.tsx
└── Topbar.tsx
```

---

## 구현 순서 (병렬 작업 가능 시점 명시)

```
Week 1
  [C] Next.js 스캐폴딩 + Tailwind + 디자인 토큰 CSS 변수 세팅
  [C] 공통 레이아웃 셸 (Sidebar + AgentStatusBar + Topbar)
  [C] Auth 페이지 (로그인/회원가입)

Week 2  ← C 셸 완성 후 A·B 병렬 시작
  [C] 대시보드 + 워치리스트 목록 + API Routes 기본
  [A] SearchInput + AddStockModal (워치리스트 내 종목 추가)
  [B] RiskBadge + RiskProgressBar + ChecklistRow (공통 컴포넌트)

Week 3
  [C] 포트폴리오 + 공시 알림 + 설정
  [A] 종목 검색 결과 UX 고도화
  [B] 리포트 상세 페이지 (ChecklistPanel + ReportSection + WarningReport)

Week 4
  [B] Q&A 페이지
  [C] MEM-01·02 (이력 저장 + 변화 감지 배너)
  [C] 온보딩 + 통합 테스트
```

---

## 현재 백엔드 → 프론트 연결 전체 맵

| 백엔드 모듈 | Next.js Route | 프론트 페이지 | 담당 |
|------------|--------------|-------------|------|
| `backend/analyzer/pipeline.py:run_pipeline_request` | `POST /api/pipeline/trigger` | 대시보드 "지금 체크", 종목 추가 | C route / B UI |
| `backend/analyzer/qa.py:ask_qa` | `POST /api/qa` | Q&A | C route / B UI |
| `backend/collector/cli/fetch_disclosures.py` | `GET /api/disclosures` | 공시 알림 패널 | C route / C UI |
| `backend/collector/krx/search.py` | `GET /api/stocks/search` | 종목 검색 | C route / A UI |
| `backend/schemas/analysis.py:AnalysisResult` | `GET /api/report/:corpCode/latest` | 리포트 상세 | C route / B UI |
