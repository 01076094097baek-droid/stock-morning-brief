"use client";

import { useState, useEffect, useRef } from "react";
import {
  CaptureSlot, SLOT_META, CaptureAnalysis, CaptureDeepAnalysis, Capture,
} from "@/lib/types";
import { getTodayCaptures, saveCapture, removeCapture, getStocks, saveBriefing } from "@/lib/storage";
import { compressImage } from "@/lib/utils";
import {
  Upload, X, Loader2, CheckCircle2, AlertCircle, Zap,
  TrendingUp, TrendingDown, Minus, ChevronRight, Send,
} from "lucide-react";
import { DailyBriefing } from "@/lib/types";

const SLOTS: CaptureSlot[] = ["morning", "midday", "close"];

interface QAMessage { role: "user" | "assistant"; content: string; }

interface StockQA { messages: QAMessage[]; input: string; loading: boolean; }

interface SlotState {
  capture: Capture | null;
  analyzing: boolean;    // Step 1: 이미지에서 종목 추출 중
  deepLoading: boolean;  // Step 2: 심층 분석 중 (종목은 이미 표시됨)
  error: string | null;
}

interface Props { onDone?: () => void; }

// ── helpers ────────────────────────────────────────────────────────────────────
function opinionMeta(op: "buy" | "hold" | "sell") {
  if (op === "buy")  return { label: "매수", bg: "bg-red-50",   border: "border-red-200",   text: "text-red-600",   Icon: TrendingUp };
  if (op === "sell") return { label: "매도", bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-600",  Icon: TrendingDown };
  return                   { label: "홀딩", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", Icon: Minus };
}

/** 하위 호환: capture 에서 다중 종목 배열 반환 */
function getAnalyses(c: Capture): CaptureAnalysis[] {
  if (c.analyses && c.analyses.length > 0) return c.analyses;
  if (c.analysis) return [c.analysis];
  return [];
}

/** 하위 호환: capture 에서 다중 심층분석 배열 반환 */
function getDeepAnalyses(c: Capture): (CaptureDeepAnalysis | undefined)[] {
  if (c.deepAnalyses && c.deepAnalyses.length > 0) return c.deepAnalyses;
  if (c.deepAnalysis) return [c.deepAnalysis];
  return [];
}

const SUGGEST_QS = [
  "지금 추가 매수해도 될까요?",
  "목표가까지 얼마나 걸릴까요?",
  "이 종목 최근 리스크 있나요?",
];

// ── Deep analysis card ─────────────────────────────────────────────────────────
function DeepCard({ deep }: { deep: CaptureDeepAnalysis }) {
  const { label, bg, border, text, Icon } = opinionMeta(deep.opinion);

  return (
    <div className="space-y-3 pt-3 border-t border-gray-100">
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${bg} ${border}`}>
        <Icon size={16} className={text} />
        <span className={`text-sm font-black ${text}`}>{label}</span>
        {deep.summary && (
          <span className="text-xs text-gray-500 ml-1 leading-snug flex-1">{deep.summary}</span>
        )}
      </div>

      {deep.opinionReasons.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">의견 근거</p>
          {deep.opinionReasons.map((r, i) => (
            <div key={i} className="flex gap-2">
              <ChevronRight size={12} className="text-violet-400 shrink-0 mt-0.5" />
              <p className="text-xs text-gray-600 leading-snug">{r}</p>
            </div>
          ))}
        </div>
      )}

      {(deep.targetPrice || deep.stopLossPrice) && (
        <div className="flex gap-2">
          {deep.targetPrice && (
            <span className="flex-1 text-center text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg py-1.5">
              목표가 {deep.targetPrice}
            </span>
          )}
          {deep.stopLossPrice && (
            <span className="flex-1 text-center text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg py-1.5">
              손절가 {deep.stopLossPrice}
            </span>
          )}
        </div>
      )}

      {deep.newsItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">최신 뉴스</p>
          {deep.newsItems.slice(0, 3).map((n, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-2.5">
              {n.url ? (
                <a href={n.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-semibold text-gray-800 leading-snug hover:text-violet-600 line-clamp-2">
                  {n.title}
                </a>
              ) : (
                <p className="text-xs font-semibold text-gray-800 leading-snug line-clamp-2">{n.title}</p>
              )}
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.summary}</p>
              {n.source && <p className="text-[10px] text-gray-300 mt-0.5">{n.source}</p>}
            </div>
          ))}
        </div>
      )}

      {deep.chartAnalysis && deep.chartAnalysis !== "캡처에 차트 정보 없음" && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">차트 흐름</p>
          <p className="text-xs text-gray-600 leading-relaxed">{deep.chartAnalysis}</p>
        </div>
      )}

      {deep.marketContext && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">시장 연관성</p>
          <p className="text-xs text-gray-600 leading-relaxed">{deep.marketContext}</p>
        </div>
      )}

      {deep.risks.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">리스크</p>
          <div className="flex flex-wrap gap-1.5">
            {deep.risks.map((r, i) => (
              <span key={i} className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-full px-2 py-0.5">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Q&A section ────────────────────────────────────────────────────────────────
function QASection({
  capture,
  analysis,
  deep,
  qa,
  onInput,
  onSend,
  onSuggest,
}: {
  capture: Capture;
  analysis: CaptureAnalysis;
  deep?: CaptureDeepAnalysis;
  qa: StockQA;
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggest: (q: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [qa.messages]);
  void capture;
  void deep;

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">질문하기</p>

      {qa.messages.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {qa.messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-violet-600 text-white rounded-br-sm"
                  : "bg-gray-100 text-gray-700 rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {qa.loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                <Loader2 size={12} className="animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {qa.messages.length === 0 && !qa.loading && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGEST_QS.map((q) => (
            <button
              key={q}
              onClick={() => onSuggest(q)}
              className="text-[11px] text-violet-600 bg-violet-50 border border-violet-200 rounded-full px-2.5 py-1 hover:bg-violet-100 active:bg-violet-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={qa.input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={analysis.stockName ? `${analysis.stockName}에 대해 질문...` : "질문을 입력하세요..."}
          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-300 focus:bg-white transition-colors"
          disabled={qa.loading}
        />
        <button
          onClick={onSend}
          disabled={qa.loading || !qa.input.trim()}
          className="p-2 bg-violet-600 text-white rounded-xl disabled:opacity-40 hover:bg-violet-700 active:bg-violet-800 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CaptureTab({ onDone }: Props) {
  const [slots, setSlots] = useState<Record<CaptureSlot, SlotState>>({
    morning: { capture: null, analyzing: false, deepLoading: false, error: null },
    midday:  { capture: null, analyzing: false, deepLoading: false, error: null },
    close:   { capture: null, analyzing: false, deepLoading: false, error: null },
  });
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDone,    setBriefingDone]    = useState(false);

  // QA state: per slot → per stock index
  const [qa, setQa] = useState<Record<CaptureSlot, StockQA[]>>({
    morning: [], midday: [], close: [],
  });

  const fileRefs = useRef<Record<CaptureSlot, HTMLInputElement | null>>({
    morning: null, midday: null, close: null,
  });

  useEffect(() => {
    const captures = getTodayCaptures();
    setSlots((prev) => {
      const next = { ...prev };
      captures.forEach((c) => { next[c.slot] = { capture: c, analyzing: false, deepLoading: false, error: null }; });
      return next;
    });
    // 기존 저장된 캡처의 QA 슬롯 초기화
    setQa((prev) => {
      const next = { ...prev };
      captures.forEach((c) => {
        const count = getAnalyses(c).length;
        next[c.slot] = Array.from({ length: count }, () => ({ messages: [], input: "", loading: false }));
      });
      return next;
    });
  }, []);

  // ── File handling (2단계) ────────────────────────────────────────────────────
  async function handleFile(slot: CaptureSlot, file: File) {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: true, deepLoading: false, error: null } }));
    setQa((prev) => ({ ...prev, [slot]: [] }));

    try {
      const imageData = await compressImage(file);

      // ── Step 1: 이미지에서 종목 추출 (약 5초) ──────────────────────────────
      const res1 = await fetch("/api/analyze-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      if (!res1.ok) {
        const errData = await res1.json().catch(() => ({}));
        throw new Error(errData.error || `서버 오류 (${res1.status})`);
      }
      const { analyses }: { analyses: CaptureAnalysis[] } = await res1.json();

      // 종목 즉시 표시 (deepAnalyses는 비어 있는 상태로 시작)
      const capture: Capture = { slot, imageData, analyses, deepAnalyses: [], capturedAt: new Date().toISOString() };
      saveCapture(capture);
      setSlots((prev) => ({ ...prev, [slot]: { capture, analyzing: false, deepLoading: true, error: null } }));
      setQa((prev) => ({
        ...prev,
        [slot]: Array.from({ length: analyses.length }, () => ({ messages: [], input: "", loading: false })),
      }));

      // 브리핑 생성은 병렬로 시작 (종목 데이터만 필요)
      generateBriefing(capture);

      // ── Step 2: 종목별 심층 분석 (병렬, 각 약 5-7초) ──────────────────────
      await Promise.all(
        analyses.map(async (analysis, idx) => {
          try {
            const res2 = await fetch("/api/analyze-capture/deep", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ analysis }),
            });
            if (!res2.ok) return;
            const deep: CaptureDeepAnalysis = await res2.json();
            // 종목별로 완료되는 즉시 UI 업데이트
            setSlots((prev) => {
              const cur = prev[slot];
              if (!cur.capture) return prev;
              const newDeep = [...(cur.capture.deepAnalyses || [])];
              newDeep[idx] = deep;
              const updated = { ...cur.capture, deepAnalyses: newDeep };
              saveCapture(updated);
              return { ...prev, [slot]: { ...cur, capture: updated } };
            });
          } catch (e) {
            console.error(`종목 ${idx} 심층분석 오류:`, e);
          }
        })
      );

      setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], deepLoading: false } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "분석 실패. 다시 시도해주세요.";
      setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: false, deepLoading: false, error: msg } }));
    }
  }

  // ── Briefing generation (스트리밍) ───────────────────────────────────────────
  async function generateBriefing(newCapture?: Capture) {
    setBriefingLoading(true);
    setBriefingDone(false);
    try {
      const allCaptures = getTodayCaptures();
      if (newCapture && !allCaptures.find((c) => c.slot === newCapture.slot)) {
        allCaptures.push(newCapture);
      }
      const capturedStocks = allCaptures.flatMap((c) =>
        c.analyses?.length ? c.analyses : c.analysis ? [c.analysis] : []
      );

      const res = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks: getStocks(),
          capturedStocks: capturedStocks.length > 0 ? capturedStocks : undefined,
        }),
      });
      if (!res.ok || !res.body) return;

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === "done" && chunk.briefing) {
              saveBriefing(chunk.briefing as DailyBriefing);
              setBriefingDone(true);
              setTimeout(() => onDone?.(), 1500);
            }
          } catch { /* 파싱 실패 무시 */ }
        }
      }
    } catch {
      // 브리핑 실패는 비치명적 – 조용히 처리
    } finally {
      setBriefingLoading(false);
    }
  }

  function remove(slot: CaptureSlot) {
    removeCapture(slot);
    setSlots((prev) => ({ ...prev, [slot]: { capture: null, analyzing: false, deepLoading: false, error: null } }));
    setQa((prev) => ({ ...prev, [slot]: [] }));
    setBriefingDone(false);
  }

  // ── Q&A helpers ──────────────────────────────────────────────────────────────
  function setStockQA(slot: CaptureSlot, stockIdx: number, updater: (prev: StockQA) => StockQA) {
    setQa((prev) => ({
      ...prev,
      [slot]: prev[slot].map((s, i) => i === stockIdx ? updater(s) : s),
    }));
  }

  async function sendQAWithText(slot: CaptureSlot, stockIdx: number, text: string) {
    const capture = slots[slot].capture;
    const analyses = capture ? getAnalyses(capture) : [];
    const deepAnalyses = capture ? getDeepAnalyses(capture) : [];
    const analysis = analyses[stockIdx];
    const deepAnalysis = deepAnalyses[stockIdx];

    const prevMessages = qa[slot]?.[stockIdx]?.messages ?? [];
    const newMessages: QAMessage[] = [...prevMessages, { role: "user", content: text }];

    setStockQA(slot, stockIdx, (s) => ({ ...s, messages: newMessages, input: "", loading: true }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch("/api/capture-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, deepAnalysis, messages: newMessages }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("답변 실패");
      const { answer } = await res.json();
      setStockQA(slot, stockIdx, (s) => ({
        ...s,
        messages: [...newMessages, { role: "assistant", content: answer }],
        loading: false,
      }));
    } catch {
      clearTimeout(timeoutId);
      setStockQA(slot, stockIdx, (s) => ({ ...s, loading: false }));
    }
  }

  function sendQA(slot: CaptureSlot, stockIdx: number) {
    const input = qa[slot]?.[stockIdx]?.input ?? "";
    if (!input.trim()) return;
    sendQAWithText(slot, stockIdx, input.trim());
  }

  function handleSuggest(slot: CaptureSlot, stockIdx: number, q: string) {
    setStockQA(slot, stockIdx, (s) => ({ ...s, input: q }));
    setTimeout(() => sendQAWithText(slot, stockIdx, q), 0);
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-6">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <span className="font-semibold text-sm text-gray-900">오늘 캡처</span>
      </div>

      {briefingLoading && (
        <div className="mx-4 mt-4 flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-2xl px-4 py-3">
          <Loader2 size={14} className="animate-spin text-violet-600 shrink-0" />
          <span className="text-sm text-violet-700 font-medium">브리핑 생성 중...</span>
        </div>
      )}
      {briefingDone && (
        <div className="mx-4 mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
          <Zap size={14} className="text-emerald-600 shrink-0" />
          <span className="text-sm text-emerald-700 font-medium">브리핑 완료! 브리핑 탭으로 이동 중...</span>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {SLOTS.map((slot) => {
          const { label, time, emoji } = SLOT_META[slot];
          const { capture, analyzing, deepLoading, error } = slots[slot];
          const analyses   = capture ? getAnalyses(capture)     : [];
          const deeps      = capture ? getDeepAnalyses(capture) : [];

          return (
            <div key={slot} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {/* Slot header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{emoji}</span>
                  <div>
                    <span className="text-sm font-semibold text-gray-900">{label}</span>
                    <span className="text-xs text-gray-400 ml-2">{time}</span>
                  </div>
                </div>
                {capture && !analyzing && (
                  <button onClick={() => remove(slot)} className="p-1 text-gray-300 hover:text-red-400">
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Hidden file input */}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                ref={(el) => { fileRefs.current[slot] = el; }}
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;
                  const slotOrder: CaptureSlot[] = ["morning", "midday", "close"];
                  const startIdx = slotOrder.indexOf(slot);
                  files.forEach((file, i) => {
                    const targetSlot = slotOrder[startIdx + i];
                    if (targetSlot) handleFile(targetSlot, file);
                  });
                  e.target.value = "";
                }}
              />

              {/* Analyzing state (Step 1: 종목 추출) */}
              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-600">종목 인식 중...</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">이미지에서 종목 추출 중</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!analyzing && !capture && (
                <div className="p-4">
                  <button
                    onClick={() => fileRefs.current[slot]?.click()}
                    className="w-full flex flex-col items-center gap-2.5 py-7 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-violet-300 hover:text-violet-500 active:bg-violet-50 transition-colors"
                  >
                    <Upload size={26} />
                    <span className="text-sm font-medium">MTS 화면 업로드</span>
                    <span className="text-xs text-gray-300">여러 장 동시 선택 가능</span>
                  </button>
                  {error && (
                    <p className="mt-2 flex items-start gap-1 text-xs text-red-500">
                      <AlertCircle size={12} className="shrink-0 mt-0.5" />{error}
                    </p>
                  )}
                </div>
              )}

              {/* Captured + analyzed state */}
              {!analyzing && capture && (
                <div className="p-4 space-y-4">
                  {/* 캡처 이미지 썸네일 */}
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capture.imageData}
                      alt="캡처"
                      className="w-14 h-20 object-cover rounded-xl shrink-0 cursor-pointer"
                      onClick={() => window.open(capture.imageData)}
                    />
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-emerald-600">분석 완료</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {analyses.length}개 종목 인식됨
                      </p>
                    </div>
                  </div>

                  {/* 종목별 카드 */}
                  {analyses.map((analysis, stockIdx) => {
                    const deep    = deeps[stockIdx];
                    const stockQA = qa[slot]?.[stockIdx] ?? { messages: [], input: "", loading: false };

                    return (
                      <div
                        key={stockIdx}
                        className={`rounded-xl border border-gray-100 p-3 space-y-3 ${
                          analyses.length > 1 ? "bg-gray-50/50" : ""
                        }`}
                      >
                        {/* 종목 기본 정보 */}
                        <div className="space-y-0.5">
                          {analyses.length > 1 && (
                            <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wider mb-1">
                              종목 {stockIdx + 1}
                            </p>
                          )}
                          {analysis.stockName && (
                            <p className="font-bold text-sm text-gray-900">{analysis.stockName}</p>
                          )}
                          {analysis.currentPrice && (
                            <p className="text-xs text-gray-500">{analysis.currentPrice}</p>
                          )}
                          {analysis.returnRate && (
                            <p className={`text-base font-black ${
                              analysis.returnRate.startsWith("-") ? "text-blue-600" : "text-red-600"
                            }`}>
                              {analysis.returnRate}
                            </p>
                          )}
                          <div className="flex gap-3 flex-wrap">
                            {analysis.avgPrice && (
                              <p className="text-xs text-gray-400">평단 {analysis.avgPrice}</p>
                            )}
                            {analysis.quantity && (
                              <p className="text-xs text-gray-400">{analysis.quantity}</p>
                            )}
                          </div>
                        </div>

                        {/* 심층 분석 */}
                        {deep && <DeepCard deep={deep} />}
                        {!deep && deepLoading && (
                          <div className="flex items-center gap-2 py-2 text-[11px] text-gray-400">
                            <Loader2 size={12} className="animate-spin shrink-0" />
                            심층 분석 중...
                          </div>
                        )}

                        {/* Q&A */}
                        {analysis.stockName && (
                          <QASection
                            capture={capture}
                            analysis={analysis}
                            deep={deep}
                            qa={stockQA}
                            onInput={(v) => setStockQA(slot, stockIdx, (s) => ({ ...s, input: v }))}
                            onSend={() => sendQA(slot, stockIdx)}
                            onSuggest={(q) => handleSuggest(slot, stockIdx, q)}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* Re-upload */}
                  <button
                    onClick={() => fileRefs.current[slot]?.click()}
                    className="text-xs text-gray-400 underline"
                  >
                    다시 업로드
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
