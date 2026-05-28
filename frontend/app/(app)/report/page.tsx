import Link from "next/link";
import Topbar from "@/components/layout/Topbar";
import RiskBadge from "@/components/ui/RiskBadge";
import { fetchReportList } from "@/lib/api/reports";

export const dynamic = "force-dynamic";

export default async function ReportListPage() {
  const detail = await fetchReportList()
    .then((value) => ({ value, error: "" }))
    .catch((error) => ({
      value: null,
      error:
        error instanceof Error
          ? error.message
          : "저 공시리가 리포트 목록을 불러오지 못했습니다.",
    }));

  const reportSummaries = detail.value?.reports ?? [];
  const fallback = detail.value?.fallback;

  return (
    <div>
      <Topbar title="리포트" showSearch={false} />
      <div style={{ padding: 16 }}>
        {detail.error && (
          <div
            style={{
              background: "#FCEBEB",
              borderLeft: "3px solid #E24B4A",
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#A32D2D",
                letterSpacing: "-0.02em",
              }}
            >
              {detail.error}
            </p>
          </div>
        )}
        {fallback?.used && reportSummaries.length === 0 && (
          <div
            style={{
              background: "#E6F1FB",
              borderLeft: "3px solid #3B8BFF",
              padding: "10px 14px",
              marginBottom: 12,
            }}
          >
            <p
              style={{
                fontSize: 12,
                color: "#185FA5",
                letterSpacing: "-0.02em",
              }}
            >
              저장된 리포트가 아직 없어 현재는 비어 있습니다. 종목 상세를 열면
              공시리가 실제 생성 결과를 저장합니다.
            </p>
          </div>
        )}
        <div
          style={{
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
          }}
        >
          {reportSummaries.length === 0 ? (
            <div
              style={{
                padding: "28px 16px",
                textAlign: "center",
                color: "var(--color-text-tertiary)",
                fontSize: 13,
                letterSpacing: "-0.02em",
              }}
            >
              표시할 리포트가 없습니다. 워치리스트에 종목을 추가하세요.
            </div>
          ) : (
            reportSummaries.map((r, i) => {
              const hasReport = r.hasReport !== false;
              const isLast = i === reportSummaries.length - 1;
              return (
                <Link
                  key={r.corpCode}
                  href={`/report/${r.corpCode}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      padding: "14px 16px",
                      borderBottom: isLast
                        ? "none"
                        : "0.5px solid var(--color-border-tertiary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      cursor: "pointer",
                      opacity: hasReport ? 1 : 0.75,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          letterSpacing: "-0.03em",
                        }}
                      >
                        {r.corpName}
                      </p>
                      {hasReport ? (
                        <p
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-tertiary)",
                            marginTop: 2,
                          }}
                        >
                          {r.analyzedAt} 분석
                        </p>
                      ) : (
                        <p
                          style={{
                            fontSize: 10,
                            color: "var(--color-text-tertiary)",
                            marginTop: 2,
                            letterSpacing: "-0.02em",
                          }}
                        >
                          리포트 미생성
                        </p>
                      )}
                    </div>
                    {hasReport ? (
                      <>
                        <RiskBadge level={r.riskLevel} size="sm" />
                        <p
                          className="font-mono"
                          style={{
                            fontSize: 12,
                            color: "var(--color-text-tertiary)",
                            minWidth: 32,
                            textAlign: "right",
                          }}
                        >
                          {r.riskScore}/6
                        </p>
                      </>
                    ) : (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "#185FA5",
                          background: "#E6F1FB",
                          border: "0.5px solid #3B8BFF",
                          borderRadius: 6,
                          padding: "3px 10px",
                          letterSpacing: "-0.02em",
                          whiteSpace: "nowrap",
                        }}
                      >
                        리포트 생성
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
