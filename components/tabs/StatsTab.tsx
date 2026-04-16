"use client";

import { useState, useEffect } from "react";
import { getStocks, getBriefing, getTodayCaptures } from "@/lib/storage";
import { Stock, DailyBriefing, Capture, CaptureAnalysis } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Camera, BarChart2, Globe, Flag } from "lucide-react";

function getAnalyses(c: Capture): CaptureAnalysis[] {
  if (c.analyses && c.analyses.length > 0) return c.analyses;
  if (c.analysis) return [c.analysis];
  return [];
}

function parseRate(rate?: string | null): number | null {
  if (!rate) return null;
  const m = rate.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function RateBar({ rate }: { rate: number }) {
  const abs  = Math.min(Math.abs(rate), 30);
  const pct  = (abs / 30) * 100;
  const pos  = rate >= 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full ${pos ? "bg-red-400" : "bg-blue-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-14 text-right ${pos ? "text-red-600" : "text-blue-600"}`}>
        {pos ? "+" : ""}{rate.toFixed(2)}%
      </span>
    </div>
  );
}

export default function StatsTab() {
  const [stocks,   setStocks]   = useState<Stock[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);

  useEffect(() => {
    setStocks(getStocks());
    setBriefing(getBriefing());
    setCaptures(getTodayCaptures());
  }, []);

  // 캡처에서 수익률 데이터 수집
  const rateItems = captures
    .flatMap(getAnalyses)
    .map((a) => ({ name: a.stockName ?? "?", rate: parseRate(a.returnRate) }))
    .filter((x): x is { name: string; rate: number } => x.rate !== null)
    .sort((a, b) => b.rate - a.rate);

  // 브리핑 판단 통계
  const judgments = briefing?.stockBriefings ?? [];
  const holdCount    = judgments.filter((j) => j.judgment === "hold").length;
  const monitorCount = judgments.filter((j) => j.judgment === "monitor").length;
  const sellCount    = judgments.filter((j) => j.judgment === "sell").length;
  const totalJudge   = judgments.length;

  // 종목 국가 통계
  const krCount = stocks.filter((s) => s.country === "KR").length;
  const usCount = stocks.filter((s) => s.country === "US").length;

  // 오늘 캡처 종목 수
  const totalCaptured = captures.flatMap(getAnalyses).length;

  return (
    <div className="pb-6">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <span className="font-semibold text-sm text-gray-900">통계</span>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* ── 보유 종목 현황 ─────────────────────────────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">보유 종목</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
              <p className="text-2xl font-black text-gray-900">{stocks.length}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">전체</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Flag size={12} className="text-blue-500" />
                <p className="text-2xl font-black text-gray-900">{krCount}</p>
              </div>
              <p className="text-[11px] text-gray-400">한국</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Globe size={12} className="text-green-500" />
                <p className="text-2xl font-black text-gray-900">{usCount}</p>
              </div>
              <p className="text-[11px] text-gray-400">미국</p>
            </div>
          </div>
        </section>

        {/* ── 오늘 캡처 현황 ─────────────────────────────────────────────────── */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">오늘 캡처</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Camera size={14} className="text-violet-500" />
                <p className="text-xs font-semibold text-gray-600">캡처 횟수</p>
              </div>
              <p className="text-2xl font-black text-gray-900">{captures.length}<span className="text-sm text-gray-400 font-normal"> / 3</span></p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-3 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <BarChart2 size={14} className="text-violet-500" />
                <p className="text-xs font-semibold text-gray-600">인식 종목</p>
              </div>
              <p className="text-2xl font-black text-gray-900">{totalCaptured}<span className="text-sm text-gray-400 font-normal"> 종목</span></p>
            </div>
          </div>

          {captures.length > 0 && (
            <div className="mt-2 flex gap-2">
              {(["morning", "midday", "close"] as const).map((slot) => {
                const slotMeta = { morning: { label: "아침", emoji: "🌅" }, midday: { label: "장중", emoji: "📊" }, close: { label: "마감", emoji: "🔔" } };
                const done = captures.some((c) => c.slot === slot);
                return (
                  <div key={slot} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-semibold border ${
                    done ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-gray-50 border-gray-100 text-gray-300"
                  }`}>
                    <span>{slotMeta[slot].emoji}</span>
                    <span>{slotMeta[slot].label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 수익률 현황 (캡처 기반) ────────────────────────────────────────── */}
        {rateItems.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              수익률 현황 <span className="text-gray-300 font-normal normal-case">(캡처 기준)</span>
            </p>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
              {rateItems.map((item, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 font-medium">{item.name}</span>
                    {item.rate >= 0
                      ? <TrendingUp size={11} className="text-red-400" />
                      : <TrendingDown size={11} className="text-blue-400" />
                    }
                  </div>
                  <RateBar rate={item.rate} />
                </div>
              ))}
            </div>

            {/* 평균 수익률 */}
            {rateItems.length > 1 && (() => {
              const avg = rateItems.reduce((s, x) => s + x.rate, 0) / rateItems.length;
              return (
                <div className={`mt-2 flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                  avg >= 0 ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                }`}>
                  <span className="text-xs text-gray-500">평균 수익률</span>
                  <span className={`text-sm font-black ${avg >= 0 ? "text-red-600" : "text-blue-600"}`}>
                    {avg >= 0 ? "+" : ""}{avg.toFixed(2)}%
                  </span>
                </div>
              );
            })()}
          </section>
        )}

        {/* ── AI 판단 분포 (브리핑 기반) ─────────────────────────────────────── */}
        {totalJudge > 0 && (
          <section>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
              AI 판단 분포 <span className="text-gray-300 font-normal normal-case">(최근 브리핑)</span>
            </p>
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "홀딩",   count: holdCount,    bg: "bg-amber-50",  text: "text-amber-600",  border: "border-amber-100", Icon: Minus },
                  { label: "모니터", count: monitorCount, bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-100", Icon: TrendingDown },
                  { label: "매도",   count: sellCount,    bg: "bg-red-50",    text: "text-red-600",    border: "border-red-100",    Icon: TrendingDown },
                ].map(({ label, count, bg, text, border, Icon }) => (
                  <div key={label} className={`flex flex-col items-center py-3 rounded-xl border ${bg} ${border}`}>
                    <Icon size={14} className={text} />
                    <p className={`text-xl font-black mt-1 ${text}`}>{count}</p>
                    <p className={`text-[10px] font-semibold ${text}`}>{label}</p>
                  </div>
                ))}
              </div>

              {/* 막대 비율 */}
              <div className="flex rounded-full overflow-hidden h-2">
                {holdCount    > 0 && <div className="bg-amber-400"  style={{ flex: holdCount }} />}
                {monitorCount > 0 && <div className="bg-orange-400" style={{ flex: monitorCount }} />}
                {sellCount    > 0 && <div className="bg-red-400"    style={{ flex: sellCount }} />}
              </div>

              <div className="mt-3 space-y-1.5">
                {briefing!.stockBriefings.map((sb, i) => {
                  const icon =
                    sb.judgment === "hold"    ? <Minus size={10} className="text-amber-500" /> :
                    sb.judgment === "monitor" ? <TrendingDown size={10} className="text-orange-500" /> :
                                                <TrendingDown size={10} className="text-red-500" />;
                  const label =
                    sb.judgment === "hold" ? "홀딩" : sb.judgment === "monitor" ? "모니터" : "매도";
                  const textColor =
                    sb.judgment === "hold" ? "text-amber-600" : sb.judgment === "monitor" ? "text-orange-600" : "text-red-600";
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{sb.stockName}</span>
                      <div className={`flex items-center gap-1 text-[11px] font-semibold ${textColor}`}>
                        {icon}{label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ── 빈 상태 ────────────────────────────────────────────────────────── */}
        {stocks.length === 0 && captures.length === 0 && !briefing && (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">📈</div>
            <p className="text-gray-500 text-sm font-medium">아직 데이터가 없어요</p>
            <p className="text-gray-400 text-xs mt-1">종목을 등록하거나 캡처를 업로드하면 통계가 표시됩니다</p>
          </div>
        )}

      </div>
    </div>
  );
}
