"use client";

import { useState, useEffect } from "react";
import { getBriefing, saveBriefing, getStocks, getTodayCaptures } from "@/lib/storage";
import { DailyBriefing } from "@/lib/types";
import { judgmentStyle, issueTagStyle, stockTypeLabel } from "@/lib/utils";
import { RefreshCw, Zap, TrendingUp, AlertTriangle, XCircle, CalendarDays, Star } from "lucide-react";

export default function BriefingTab() {
  const [data,    setData]    = useState<DailyBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [isAuto,  setIsAuto]  = useState(false);

  useEffect(() => {
    const local = getBriefing();
    if (local) setData(local);

    fetch("/api/briefing/latest")
      .then((r) => r.json())
      .then(({ briefing }) => {
        if (!briefing) return;
        const localTime = local ? new Date(local.generatedAt).getTime() : 0;
        if (new Date(briefing.generatedAt).getTime() > localTime) {
          saveBriefing(briefing);
          setData(briefing);
          setIsAuto(true);
        }
      })
      .catch(() => {});
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const stocks = getStocks();
      const captures = getTodayCaptures();
      const capturedStocks = captures.map((c) => c.analysis).filter(Boolean);
      const res = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks,
          capturedStocks: capturedStocks.length > 0 ? capturedStocks : undefined,
          useWebSearch: true,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "생성 실패");
      const result: DailyBriefing = await res.json();
      saveBriefing(result);
      setData(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  const JudgmentIcon = ({ j }: { j: string }) => {
    if (j === "hold")    return <TrendingUp size={11} />;
    if (j === "monitor") return <AlertTriangle size={11} />;
    return <XCircle size={11} />;
  };

  return (
    <div className="pb-6">
      {/* Sub-header */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-gray-900">오늘 브리핑</span>
          {isAuto && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
              <Zap size={9} />자동
            </span>
          )}
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full disabled:opacity-60"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {loading ? "생성 중..." : "새로 생성"}
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="space-y-3 animate-pulse">
            {[96, 120, 96, 96, 96].map((h, i) => (
              <div key={i} className="bg-gray-100 rounded-2xl" style={{ height: h }} />
            ))}
          </div>
        )}

        {!data && !loading && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📊</div>
            <p className="text-gray-500 text-sm font-medium">오늘 브리핑이 없어요</p>
            <p className="text-gray-400 text-xs mt-1">캡처를 올리거나 직접 생성하세요</p>
          </div>
        )}

        {data && !loading && (
          <>
            <p className="text-xs text-gray-400">
              {new Date(data.generatedAt).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })} 생성
            </p>

            {/* Market Summary */}
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 rounded-2xl p-4">
              <p className="text-[11px] font-bold text-violet-500 uppercase tracking-wider mb-2">시장 요약</p>
              <p className="text-sm text-gray-700 leading-relaxed">{data.marketSummary}</p>
            </div>

            {/* Weekly Issues */}
            {data.weeklyIssues && data.weeklyIssues.length > 0 && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <CalendarDays size={13} />주간 이슈
                </p>
                <div className="space-y-3">
                  {data.weeklyIssues.map((issue, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <p className="font-semibold text-sm text-gray-900 mb-1.5">{issue.title}</p>
                      <p className="text-xs text-gray-500 leading-relaxed mb-2">{issue.description}</p>
                      {issue.relatedStocks.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {issue.relatedStocks.map((rs, j) => {
                            const ts = issueTagStyle(rs.tag);
                            return (
                              <span key={j} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                                {rs.stockName} · {ts.label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Stock Briefings */}
            {data.stockBriefings.length > 0 && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">내 종목</p>
                <div className="space-y-3">
                  {data.stockBriefings.map((sb, i) => {
                    const style = judgmentStyle(sb.judgment);
                    return (
                      <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-gray-900">{sb.stockName}</span>
                          <span className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                            <JudgmentIcon j={sb.judgment} />
                            {style.label}
                          </span>
                        </div>
                        {(sb.currentPrice || sb.returnRate) && (
                          <div className="flex items-center gap-3 mb-2">
                            {sb.currentPrice && <span className="text-xs text-gray-600">{sb.currentPrice}</span>}
                            {sb.returnRate && (
                              <span className={`text-xs font-bold ${sb.returnRate.startsWith("-") ? "text-blue-600" : "text-red-600"}`}>
                                {sb.returnRate}
                              </span>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-500 leading-relaxed">{sb.summary}</p>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Recommended Stocks */}
            {data.recommendedStocks.length > 0 && (
              <section>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Star size={13} />오늘의 추천
                </p>
                <div className="space-y-3">
                  {data.recommendedStocks.map((rs, i) => (
                    <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-semibold text-sm text-gray-900">{rs.name}</span>
                          <span className="ml-2 text-xs text-gray-400">{rs.code}</span>
                        </div>
                        <span className="text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 shrink-0">
                          {stockTypeLabel(rs.type)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{rs.reason}</p>
                      <div className="space-y-1">
                        {rs.bullets.map((b, j) => (
                          <p key={j} className="text-xs text-gray-500 flex gap-1.5">
                            <span className="text-violet-400 shrink-0">•</span>{b}
                          </p>
                        ))}
                      </div>
                      {rs.targetPrice && (
                        <p className="mt-2 text-xs font-semibold text-violet-600">목표가 {rs.targetPrice}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
