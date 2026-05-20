# 08. Design System — 공시리 UI 기준

> 원본 파일: `assets/gongsiri_design_system_final.html`, `assets/gongsiri_main_dashboard.html`
> 이 문서가 프론트엔드 구현의 SoT. 코드보다 디자인이 우선.

---

## 브랜드

| 항목 | 값 |
|------|----|
| 로고 워드마크 | **Bebas Neue** `−0.07em` |
| 로고 서브 | `DISCLOSURE AI` `0.08em` |
| 브랜드 컬러 | Navy `#0A0F1C` · Blue `#3B8BFF` · Red `#E24B4A` |

---

## 컬러 시스템

| 이름 | Hex | 용도 |
|------|-----|------|
| Navy Black | `#0A0F1C` | 사이드바 배경, Primary 버튼 |
| Signal Blue | `#3B8BFF` | 링크, 인터랙티브, 강조 |
| Alert Red | `#E24B4A` | 위험 등급, 주가 상승 |
| Caution Amber | `#BA7517` | 주의 등급 |
| Safe Green | `#639922` | 정상 등급, 통과 |
| Neutral Gray | `#5F5E5A` | 보조 텍스트, 비활성 |

### CSS 변수 (구현 시 반드시 사용)

```css
/* Light mode 기준 */
--color-text-primary
--color-text-secondary
--color-text-tertiary
--color-background-primary   /* 카드 배경 */
--color-background-secondary /* 페이지 배경 */
--color-border-primary
--color-border-secondary
--color-border-tertiary
--border-radius-lg           /* 카드, 패널 */
--border-radius-md           /* 버튼, 인풋, 뱃지 */
```

---

## 타이포그래피

| 스타일 | 폰트 | 크기 | 굵기 | 자간 | 용도 |
|--------|------|------|------|------|------|
| Display | Bebas Neue | 36px | — | −0.07em | 로고, 히어로 타이틀 |
| H1 | Noto Sans KR | 20px | 700 | −0.04em | 페이지 제목 |
| H2 | Noto Sans KR | 16px | 500 | −0.03em | 섹션 제목 |
| Body | Noto Sans KR | 14px | 400 | −0.03em | 본문 lh 1.65 |
| Caption | Noto Sans KR | 11px | 400 | −0.01em | 보조 레이블 |
| Mono | IBM Plex Mono | 13px | 400/500 | 0 | 숫자, 코드, 시세 |

---

## 컴포넌트

### RiskBadge
```
안전  → bg #EAF3DE · text #3B6D11 · dot #639922
주의  → bg #FAEEDA · text #854F0B · dot #BA7517
위험  → bg #FCEBEB · text #A32D2D · dot #E24B4A
```
- padding: `3–4px 8–12px`, border-radius: `100px`
- dot: `5–6px` 원형

### AlertCard
- 왼쪽 3px solid 보더
- 주의: bg `#FAEEDA` border `#BA7517`
- 위험: bg `#FCEBEB` border `#E24B4A`
- border-radius: 0 (의도된 스타일)

### StockCard
- 종목명(500) + 종목코드(Mono, tertiary)
- 현재가(Mono 20px) + 등락(Mono 12px, up=#E24B4A dn=#185FA5)
- 작전주 지수 progress bar (4px, border-radius 100px)
- border: `0.5px solid --color-border-tertiary`

### ChecklistRow
- pass: bg `#EAF3DE` color `#3B6D11`
- fail: bg `#FCEBEB` color `#A32D2D`
- unknown: bg secondary color tertiary, `–` 텍스트
- 아이콘: 20px 원형, 마지막 행 제외 border-bottom

### MetricCard
- Mono 22px 숫자 + 11px 레이블
- border: `0.5px solid --color-border-tertiary`
- padding: `12px 14px`

### Navigation (Sidebar)
- 배경: `#0A0F1C`
- active item: bg `#1A2235`, text `#E8F4FF 500`
- inactive: text `#888780`
- 뱃지(알림 수): bg `#E24B4A` Mono 10px

### Button
- Primary: bg `#0A0F1C` color `#E8F4FF` 13px 500
- Secondary: transparent border `0.5px --color-border-secondary` 13px 400

### Input
- height 40px, border `0.5px --color-border-secondary`
- padding-left 36px (아이콘 공간), font 14px

---

## 레이아웃

```
┌─────────────────────────────────────────────────┐
│ Agent Status Bar (dark #0A0F1C)                 │
├──────────┬──────────────────────────────────────┤
│          │ Topbar (title + search + CTA)        │
│ Sidebar  ├──────────────────────────────────────┤
│ 200px    │                                      │
│ #0A0F1C  │ Content Area (bg secondary)          │
│          │ padding 16px, gap 14px               │
└──────────┴──────────────────────────────────────┘
```

### Agent Status Bar (항상 상단 고정)
- 배경: `#0A0F1C`
- 녹색 펄싱 dot + "에이전트 모니터링 중" + 다음 폴링 시간
- "지금 체크" 버튼: bg `#1A2235` border `#2A3A52` color `#B5D4F4`

### 사이드바 메뉴 구조
```
메인
  대시보드
  워치리스트   [뱃지: 종목 수]
  공시 알림    [뱃지: 미확인 수]

분석
  리포트
  포트폴리오
  Q&A

설정
  설정
```

### 대시보드 콘텐츠 그리드
```
[Metric ×4]
[워치리스트 테이블 | 최근 공시 알림]
                   [포트폴리오 리스크]
```

### 워치리스트 테이블 컬럼
`종목 | 현재가(right) | 등락(right) | 리스크(center) | 작전주 지수`

---

## 아이콘
Tabler Icons (`ti` 클래스) 사용:
- `ti-layout-dashboard`, `ti-eye`, `ti-bell`, `ti-file-analytics`
- `ti-chart-pie`, `ti-message-2`, `ti-settings`
- `ti-search`, `ti-plus`, `ti-refresh`, `ti-chevron-right`
