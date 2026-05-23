"use client";

import { useEffect, useRef, useState } from "react";
import { IconSend } from "@tabler/icons-react";
import Topbar from "@/components/layout/Topbar";
import Button from "@/components/ui/Button";
import MarkdownContent from "@/components/ui/MarkdownContent";
import RiskBadge from "@/components/ui/RiskBadge";
import { useDemoSession } from "@/lib/demo-session";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface QaHistoryItem {
  id: string;
  corpCode: string;
  corpName: string;
  question: string;
  answer: string;
  askedAt: string;
}

function resolveQaFailure(data: unknown): string {
  if (typeof data === "object" && data !== null) {
    const record = data as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };
    return (
      record.error?.message ??
      record.message ??
      record.detail ??
      "저 공시리가 답변을 가져오지 못했습니다."
    );
  }
  return "저 공시리가 답변을 가져오지 못했습니다.";
}

function formatAskedAt(value: string) {
  return value || "시각 정보 없음";
}

export default function QAPage() {
  const { qaStockOptions } = useDemoSession();
  const [selectedCorp, setSelectedCorp] = useState(
    () => qaStockOptions[0]?.corp_code ?? "",
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<QaHistoryItem[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeCorpCode = qaStockOptions.some(
    (s) => s.corp_code === selectedCorp,
  )
    ? selectedCorp
    : (qaStockOptions[0]?.corp_code ?? "");
  const corp = qaStockOptions.find((s) => s.corp_code === activeCorpCode);

  async function loadHistory(corpCode: string) {
    if (!corpCode) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await fetch(
        `/api/qa/history?corp_code=${encodeURIComponent(corpCode)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || data?.ok !== true || !Array.isArray(data.items)) {
        throw new Error(resolveQaFailure(data));
      }
      setHistory(data.items as QaHistoryItem[]);
    } catch (error) {
      setHistory([]);
      setHistoryError(
        error instanceof Error
          ? error.message
          : "저 공시리가 Q&A 이력을 불러오지 못했습니다.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory(activeCorpCode);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeCorpCode]);

  // 새 메시지·로딩 상태가 바뀌면 대화창 맨 아래로 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  async function handleSend() {
    if (!corp || !input.trim() || loading) return;
    const question = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corp_code: corp.corp_code, question }),
      });
      const data = await res.json();

      if (!res.ok || typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error(resolveQaFailure(data));
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
      await loadHistory(corp.corp_code);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "저 공시리가 답변을 가져오지 못했습니다.";
      setMessages((prev) => [...prev, { role: "assistant", content: message }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 52px - 36px)",
      }}
    >
      <Topbar title="Q&A" showSearch={false} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 12,
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}>
            분석 종목
          </span>
          <select
            value={activeCorpCode}
            onChange={(e) => {
              setSelectedCorp(e.target.value);
              setMessages([]);
            }}
            style={{
              fontSize: 13,
              fontFamily: "Noto Sans KR, sans-serif",
              letterSpacing: "-0.03em",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--radius-md)",
              padding: "5px 10px",
              background: "var(--color-bg-primary)",
              outline: "none",
            }}
          >
            {qaStockOptions.map((s) => (
              <option key={s.corp_code} value={s.corp_code}>
                {s.corp_name}
              </option>
            ))}
          </select>
          {corp && <RiskBadge level={corp.risk_level} size="sm" />}
        </div>

        <div
          style={{
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--radius-lg)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setHistoryOpen((open) => !open)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 16px",
              background: "transparent",
              border: 0,
              cursor: "pointer",
            }}
          >
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-tertiary)",
                letterSpacing: "-0.02em",
              }}
            >
              최근 저장된 Q&A{history.length > 0 ? ` (${history.length})` : ""}
            </span>
            <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
              {historyOpen ? "접기 ▲" : "펼치기 ▼"}
            </span>
          </button>
          {historyOpen && (
            <div
              style={{
                padding: "0 16px 12px",
                maxHeight: 180,
                overflowY: "auto",
              }}
            >
              {historyLoading ? (
                <p
                  style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
                >
                  공시리가 최근 질문 이력을 불러오는 중입니다...
                </p>
              ) : historyError ? (
                <p style={{ fontSize: 12, color: "#A32D2D" }}>{historyError}</p>
              ) : history.length === 0 ? (
                <p
                  style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
                >
                  저장된 Q&A 이력이 없습니다.
                </p>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {history.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--color-bg-secondary)",
                        borderRadius: "var(--radius-md)",
                        padding: "8px 12px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {item.question}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          lineHeight: 1.5,
                          color: "var(--color-text-secondary)",
                          marginTop: 3,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {item.answer}
                      </p>
                      <p
                        className="font-mono"
                        style={{
                          fontSize: 10,
                          color: "var(--color-text-tertiary)",
                          marginTop: 5,
                        }}
                      >
                        {formatAskedAt(item.askedAt)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            background: "var(--color-bg-primary)",
            border: "0.5px solid var(--color-border-tertiary)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.length === 0 && (
              <div style={{ textAlign: "center", marginTop: 40 }}>
                <p
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-tertiary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {corp
                    ? `${corp.corp_name} 관련 공시·분석 내용에 대해 질문하세요.`
                    : "워치리스트 종목을 추가하면 Q&A를 사용할 수 있습니다."}
                </p>
                {corp && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "center",
                      marginTop: 16,
                    }}
                  >
                    {[
                      "CB 발행의 영향은?",
                      "최근 공시 요약해줘",
                      "위험 수준이 높아진 이유는?",
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => setInput(q)}
                        style={{
                          fontSize: 12,
                          color: "#3B8BFF",
                          border: "0.5px solid #3B8BFF",
                          borderRadius: 100,
                          padding: "5px 12px",
                          background: "#EBF2FF",
                          cursor: "pointer",
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    lineHeight: 1.65,
                    letterSpacing: "-0.02em",
                    background:
                      m.role === "user"
                        ? "var(--color-navy)"
                        : "var(--color-bg-secondary)",
                    color:
                      m.role === "user"
                        ? "#E8F4FF"
                        : "var(--color-text-primary)",
                  }}
                >
                  {m.role === "assistant" ? (
                    <MarkdownContent content={m.content} />
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: "var(--color-bg-secondary)",
                    fontSize: 13,
                    color: "var(--color-text-tertiary)",
                  }}
                >
                  공시리가 답변을 준비하고 있습니다...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              borderTop: "0.5px solid var(--color-border-tertiary)",
              padding: "12px 16px",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && handleSend()
              }
              placeholder={
                corp
                  ? `${corp.corp_name}에 대해 질문하세요`
                  : "종목을 선택하세요"
              }
              style={{
                flex: 1,
                height: 36,
                padding: "0 12px",
                fontSize: 13,
                fontFamily: "Noto Sans KR, sans-serif",
                letterSpacing: "-0.03em",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: "var(--radius-md)",
                outline: "none",
                background: "var(--color-bg-primary)",
              }}
            />
            <Button
              onClick={handleSend}
              disabled={!corp || !input.trim() || loading}
              size="sm"
            >
              <IconSend size={13} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
