import { test, expect } from "@playwright/test";

/**
 * 공시리 데모 시나리오 — 4단계 한 사이클 녹화
 *
 * 1. 로그인 (admin/admin)
 * 2. 워치리스트에 SK하이닉스 추가
 * 3. 리포트 목록에서 삼성전자 재분석
 * 4. QA에서 삼성전자 질의
 */

const SAMSUNG_CORP_CODE = "00126380";
const SKHYNIX_CORP_CODE = "00164779";

test("공시리 데모 시나리오", async ({ page }) => {
  // ──────────────────────────────────────────
  // 1단계: 로그인
  // ──────────────────────────────────────────
  await page.goto("/login");
  await expect(page)
    .toHaveTitle(/공시리|gongsiri/i, { timeout: 10_000 })
    .catch(() => {});

  // 로그인 폼: admin/admin 기본값이 이미 세팅돼 있지만 명시적으로 채움
  await page.locator('input[autocomplete="username"]').fill("admin");
  await page.locator('input[autocomplete="current-password"]').fill("admin");
  await page.waitForTimeout(500);
  await page.locator('button[type="submit"]').click();

  // 대시보드로 리다이렉트 대기
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await page.waitForTimeout(1000);

  // ──────────────────────────────────────────
  // 2단계: 워치리스트에 SK하이닉스 추가
  // ──────────────────────────────────────────
  await page.goto("/watchlist");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // "종목 추가" 버튼 클릭 — 텍스트로 찾기
  const addButton = page.getByRole("button", { name: "종목 추가" });
  await addButton.waitFor({ state: "visible", timeout: 10_000 });
  await addButton.click();
  await page.waitForTimeout(600);

  // 모달 내 검색창에 "하이닉스" 입력 (type()으로 React onChange 트리거)
  const searchInput = page.locator(
    'input[placeholder="종목명 또는 코드 검색"]',
  );
  await searchInput.waitFor({ state: "visible", timeout: 8_000 });
  await searchInput.click();
  await searchInput.type("하이닉스", { delay: 80 });
  await page.waitForTimeout(2000);

  // 검색 결과에서 에스케이하이닉스보통주 선택
  const hynixRow = page
    .locator("button")
    .filter({ hasText: /에스케이하이닉스/ })
    .first();
  await hynixRow.waitFor({ state: "visible", timeout: 15_000 });
  await hynixRow.click();
  await page.waitForTimeout(600);

  // 선택 확인 후 "종목 추가" 버튼 클릭
  // 모달 내 "종목 추가" 버튼 (두 번째 또는 마지막 버튼)
  const modalAddButton = page
    .locator("button")
    .filter({ hasText: /^종목 추가$/ })
    .last();
  await modalAddButton.waitFor({ state: "visible", timeout: 8_000 });
  await modalAddButton.click();
  await page.waitForTimeout(1500);

  // 등록 완료 메시지 또는 이미 있음 메시지 대기
  await page.waitForTimeout(1000);

  // 모달 닫힘 대기 (모달이 사라지거나 워치리스트 목록에 반영)
  await page.waitForTimeout(1200);

  // ──────────────────────────────────────────
  // 3단계: 리포트 목록에서 삼성전자 재분석
  // ──────────────────────────────────────────
  await page.goto("/report");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // 삼성전자 행 또는 리포트 항목 클릭 → 상세 페이지 이동
  // 삼성전자 링크가 있으면 클릭, 없으면 직접 URL 이동
  const samsungLink = page
    .locator("a")
    .filter({ hasText: /삼성전자/ })
    .first();
  const samsungLinkCount = await samsungLink.count();

  if (samsungLinkCount > 0) {
    await samsungLink.click();
  } else {
    // 삼성전자 행이 없으면 직접 리포트 상세 URL로 이동
    await page.goto(`/report/${SAMSUNG_CORP_CODE}`);
  }

  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);

  // "재분석" 버튼 클릭
  const reanalyzeButton = page.getByRole("button", { name: /재분석/ });
  await reanalyzeButton.waitFor({ state: "visible", timeout: 15_000 });
  await reanalyzeButton.click();
  await page.waitForTimeout(2000);

  // 리포트 생성 완료 대기 (최대 90초)
  // 로딩 스피너 또는 분석 중 메시지가 사라질 때까지 대기
  const analysisComplete = page
    .locator('[data-risk-level], .checklist, [class*="checklist"]')
    .first();

  // 90초 내에 결과가 렌더링되길 기다림
  // 버튼 상태가 복귀하거나 체크리스트 항목이 보이면 완료
  try {
    await page.waitForSelector("[data-risk-level], h2, h3", {
      timeout: 90_000,
    });
  } catch {
    // 타임아웃이어도 계속 진행
  }
  await page.waitForTimeout(2000);

  // 페이지 스크롤 다운 — 6개 항목 + 단기/장기 리포트 확인
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: "smooth" }));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: "smooth" }));
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "smooth" }));
  await page.waitForTimeout(1000);

  // ──────────────────────────────────────────
  // 4단계: QA에서 삼성전자 질의 (multi-turn)
  // ──────────────────────────────────────────
  await page.goto("/qa");
  await page.waitForLoadState("networkidle");

  // A. reload → DemoSessionProvider 재마운트 → qaStockOptions refetch
  await page.reload();
  await page.waitForLoadState("networkidle");

  // B. select options 채워질 때까지 명시적 대기
  await page.waitForFunction(
    () => {
      const sel = document.querySelector("select");
      return sel !== null && sel.options.length > 0;
    },
    { timeout: 15_000 },
  );

  // C. 삼성전자 선택 (value = corp_code), fallback: 라벨 텍스트 매칭
  const corpSelect = page.locator("select").first();
  await corpSelect
    .selectOption({ value: SAMSUNG_CORP_CODE })
    .catch(async () => {
      const opts = await corpSelect.locator("option").allTextContents();
      const match = opts.find((t) => /삼성전자/.test(t));
      if (match) await corpSelect.selectOption({ label: match });
    });
  await page.waitForTimeout(800);

  // D. QA input — placeholder가 종목명 기반으로 동적으로 바뀜, "에 대해 질문하세요" 포함
  const qaInput = page.locator('input[placeholder*="에 대해 질문하세요"]');
  await qaInput.waitFor({ state: "visible", timeout: 10_000 });

  // 1턴: 첫 번째 질문 (Enter로 전송)
  await qaInput.fill("삼성전자의 최근 위험 시그널은 뭔가요?");
  await qaInput.press("Enter");

  // E. assistant 응답 도착 대기 — 화면에 '삼성전자' 텍스트 + 충분한 응답 길이 확인
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes("삼성전자") && text.length > 200;
    },
    { timeout: 90_000 },
  );
  await page.waitForTimeout(1500);

  // F. 2턴째 질문
  await qaInput.fill("단기적으로 가장 위험한 신호는 뭔가요?");
  await qaInput.press("Enter");

  // 2턴 응답 대기 — 1턴보다 본문이 더 길어졌음을 확인
  const bodyAfterTurn1 = await page.evaluate(
    () => document.body.innerText.length,
  );
  await page.waitForFunction(
    (prevLen: number) => document.body.innerText.length > prevLen + 50,
    bodyAfterTurn1,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(1500);

  // G. 스크롤 다운 후 2초 hold
  await page.evaluate(() =>
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }),
  );
  await page.waitForTimeout(2000);

  // 데모 완료 — 최종 화면 2초 유지
  await page.waitForTimeout(2000);
});
