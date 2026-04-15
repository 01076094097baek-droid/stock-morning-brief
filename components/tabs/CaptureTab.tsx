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

interface SlotState {
  capture: Capture | null;
  analyzing: boolean;
  error: string | null;
}

interface Props { onDone?: () => void; }

// ── Opinion helpers ────────────────────────────────────────────────────────────
function opinionMeta(op: "buy" | "hold" | "sell") {
  if (op === "buy")  return { label: "매수", bg: "bg-red-50",   border: "border-red-200",   text: "text-red-600",   Icon: TrendingUp };
  if (op === "sell") return { label: "매도", bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-600",  Icon: TrendingDown };
  return                   { label: "홀딩", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-600", Icon: Minus };
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
      {/* Opinion badge + summary */}
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${bg} ${border}`}>
        <Icon size={16} className={text} />
        <span className={`text-sm font-black ${text}`}>{label}</span>
        {deep.summary && (
          <span className="text-xs text-gray-500 ml-1 leading-snug flex-1">{deep.summary}</span>
        )}
      </div>

      {/* Opinion reasons */}
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

      {/* Target / stop-loss */}
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

      {/* Latest news */}
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

      {/* Chart analysis */}
      {deep.chartAnalysis && deep.chartAnalysis !== "캡처에 차트 정보 없음" && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">차트 흐름</p>
          <p className="text-xs text-gray-600 leading-relaxed">{deep.chartAnalysis}</p>
        </div>
      )}

      {/* Market context */}
      {deep.marketContext && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">시장 연관성</p>
          <p className="text-xs text-gray-600 leading-relaxed">{deep.marketContext}</p>
        </div>
      )}

      {/* Risks */}
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
  messages,
  input,
  loading,
  onInput,
  onSend,
  onSuggest,
}: {
  capture: Capture;
  messages: QAMessage[];
  input: string;
  loading: boolean;
  onInput: (v: string) => void;
  onSend: () => void;
  onSuggest: (q: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  return (
    <div className="pt-3 border-t border-gray-100 space-y-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">질문하기</p>

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {messages.map((m, i) => (
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
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2">
                <Loader2 size={12} className="animate-spin text-gray-400" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Suggested questions (shown only before first message) */}
      {messages.length === 0 && !loading && (
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

      {/* Input row */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={capture.analysis?.stockName ? `${capture.analysis.stockName}에 대해 질문...` : "질문을 입력하세요..."}
          className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-violet-300 focus:bg-white transition-colors"
          disabled={loading}
        />
        <button
          onClick={onSend}
          disabled={loading || !input.trim()}
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
    morning: { capture: null, analyzing: false, error: null },
    midday:  { capture: null, analyzing: false, error: null },
    close:   { capture: null, analyzing: false, error: null },
  });
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDone,    setBriefingDone]    = useState(false);

  // Q&A state per slot
  const [qa, setQa] = useState<Record<CaptureSlot, { messages: QAMessage[]; input: string; loading: boolean }>>({
    morning: { messages: [], input: "", loading: false },
    midday:  { messages: [], input: "", loading: false },
    close:   { messages: [], input: "", loading: false },
  });

  const fileRefs = useRef<Record<CaptureSlot, HTMLInputElement | null>>({
    morning: null, midday: null, close: null,
  });

  useEffect(() => {
    const captures = getTodayCaptures();
    setSlots((prev) => {
      const next = { ...prev };
      captures.forEach((c) => { next[c.slot] = { capture: c, analyzing: false, error: null }; });
      return next;
    });
  }, []);

  // ── File handling ────────────────────────────────────────────────────────────
  async function handleFile(slot: CaptureSlot, file: File) {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: true, error: null } }));
    // Reset Q&A for this slot
    setQa((prev) => ({ ...prev, [slot]: { messages: [], input: "", loading: false } }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const imageData = await compressImage(file);
      const res = await fetch("/api/analyze-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `서버 오류 (${res.status})`);
      }
      const { analysis, deepAnalysis }: { analysis: CaptureAnalysis; deepAnalysis: CaptureDeepAnalysis } = await res.json();
      const capture: Capture = { slot, imageData, analysis, deepAnalysis, capturedAt: new Date().toISOString() };
      saveCapture(capture);
      setSlots((prev) => ({ ...prev, [slot]: { capture, analyzing: false, error: null } }));
      await generateBriefing(capture);
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      const msg = e instanceof Error
        ? (e.name === "AbortError" ? "분석 시간 초과 (60초). 다시 시도해주세요." : e.message)
        : "분석 실패. 다시 시도해주세요.";
      setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: false, error: msg } }));
    }
  }

  // ── Briefing generation ──────────────────────────────────────────────────────
  async function generateBriefing(newCapture?: Capture) {
    setBriefingLoading(true);
    setBriefingDone(false);
    try {
      const allCaptures = getTodayCaptures();
      if (newCapture && !allCaptures.find((c) => c.slot === newCapture.slot)) {
        allCaptures.push(newCapture);
      }
      const capturedStocks = allCaptures.map((c) => c.analysis).filter(Boolean);
      const res = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks: getStocks(), capturedStocks: capturedStocks.length > 0 ? capturedStocks : undefined, useWebSearch: true }),
      });
      if (!res.ok) return;
      const result: DailyBriefing = await res.json();
      saveBriefing(result);
      setBriefingDone(true);
      setTimeout(() => onDone?.(), 1500);
    } finally {
      setBriefingLoading(false);
    }
  }

  function remove(slot: CaptureSlot) {
    removeCapture(slot);
    setSlots((prev) => ({ ...prev, [slot]: { capture: null, analyzing: false, error: null } }));
    setQa((prev) => ({ ...prev, [slot]: { messages: [], input: "", loading: false } }));
    setBriefingDone(false);
  }

  // ── Q&A ──────────────────────────────────────────────────────────────────────
  async function sendQA(slot: CaptureSlot) {
    const { input, messages } = qa[slot];
    if (!input.trim()) return;
    const capture = slots[slot].capture;
    const newMessages: QAMessage[] = [...messages, { role: "user", content: input.trim() }];
    setQa((prev) => ({ ...prev, [slot]: { messages: newMessages, input: "", loading: true } }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch("/api/capture-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: capture?.analysis, deepAnalysis: capture?.deepAnalysis, messages: newMessages }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("답변 실패");
      const { answer } = await res.json();
      setQa((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], messages: [...newMessages, { role: "assistant", content: answer }], loading: false },
      }));
    } catch {
      clearTimeout(timeoutId);
      setQa((prev) => ({ ...prev, [slot]: { ...prev[slot], loading: false } }));
    }
  }

  function handleSuggest(slot: CaptureSlot, q: string) {
    setQa((prev) => ({ ...prev, [slot]: { ...prev[slot], input: q } }));
    setTimeout(() => sendQAWithText(slot, q), 0);
  }

  async function sendQAWithText(slot: CaptureSlot, text: string) {
    const { messages } = qa[slot];
    const capture = slots[slot].capture;
    const newMessages: QAMessage[] = [...messages, { role: "user", content: text }];
    setQa((prev) => ({ ...prev, [slot]: { messages: newMessages, input: "", loading: true } }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch("/api/capture-qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis: capture?.analysis, deepAnalysis: capture?.deepAnalysis, messages: newMessages }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error("답변 실패");
      const { answer } = await res.json();
      setQa((prev) => ({
        ...prev,
        [slot]: { ...prev[slot], messages: [...newMessages, { role: "assistant", content: answer }], loading: false },
      }));
    } catch {
      clearTimeout(timeoutId);
      setQa((prev) => ({ ...prev, [slot]: { ...prev[slot], loading: false } }));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="pb-6">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <span className="font-semibold text-sm text-gray-900">오늘 캡처</span>
      </div>

      {/* Briefing status */}
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
          const { capture, analyzing, error } = slots[slot];
          const slotQA = qa[slot];
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

              {/* Analyzing state */}
              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-10">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <div className="text-center">
                    <p className="text-xs font-semibold text-gray-600">AI 심층 분석 중...</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">웹 검색 포함 · 최대 60초</p>
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
                <div className="p-4 space-y-3">
                  {/* Stock overview row */}
                  <div className="flex gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={capture.imageData}
                      alt="캡처"
                      className="w-14 h-20 object-cover rounded-xl shrink-0 cursor-pointer"
                      onClick={() => window.open(capture.imageData)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                        <span className="text-[11px] font-semibold text-emerald-600">분석 완료</span>
                      </div>
                      {capture.analysis?.stockName && (
                        <p className="font-bold text-sm text-gray-900 truncate">{capture.analysis.stockName}</p>
                      )}
                      {capture.analysis?.currentPrice && (
                        <p className="text-xs text-gray-500 mt-0.5">{capture.analysis.currentPrice}</p>
                      )}
                      {capture.analysis?.returnRate && (
                        <p className={`text-base font-black mt-0.5 ${
                          capture.analysis.returnRate.startsWith("-") ? "text-blue-600" : "text-red-600"
                        }`}>
                          {capture.analysis.returnRate}
                        </p>
                      )}
                      {capture.analysis?.avgPrice && (
                        <p className="text-xs text-gray-400">평단 {capture.analysis.avgPrice}</p>
                      )}
                      {capture.analysis?.quantity && (
                        <p className="text-xs text-gray-400">{capture.analysis.quantity}</p>
                      )}
                    </div>
                  </div>

                  {/* Deep analysis */}
                  {capture.deepAnalysis && <DeepCard deep={capture.deepAnalysis} />}

                  {/* Q&A */}
                  {capture.analysis?.stockName && (
                    <QASection
                      capture={capture}
                      messages={slotQA.messages}
                      input={slotQA.input}
                      loading={slotQA.loading}
                      onInput={(v) => setQa((prev) => ({ ...prev, [slot]: { ...prev[slot], input: v } }))}
                      onSend={() => sendQA(slot)}
                      onSuggest={(q) => handleSuggest(slot, q)}
                    />
                  )}

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
