"use client";

import { useState, useEffect, useRef } from "react";
import { CaptureSlot, SLOT_META, CaptureAnalysis, Capture } from "@/lib/types";
import { getTodayCaptures, saveCapture, removeCapture, getStocks, saveBriefing } from "@/lib/storage";
import { compressImage } from "@/lib/utils";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { DailyBriefing } from "@/lib/types";

const SLOTS: CaptureSlot[] = ["morning", "midday", "close"];

interface SlotState {
  capture: Capture | null;
  analyzing: boolean;
  error: string | null;
}

interface Props { onDone?: () => void; }

export default function CaptureTab({ onDone }: Props) {
  const [slots, setSlots] = useState<Record<CaptureSlot, SlotState>>({
    morning: { capture: null, analyzing: false, error: null },
    midday:  { capture: null, analyzing: false, error: null },
    close:   { capture: null, analyzing: false, error: null },
  });
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDone,    setBriefingDone]    = useState(false);
  const fileRefs = useRef<Record<CaptureSlot, HTMLInputElement | null>>({
    morning: null, midday: null, close: null,
  });

  useEffect(() => {
    const captures = getTodayCaptures();
    setSlots((prev) => {
      const next = { ...prev };
      captures.forEach((c) => {
        next[c.slot] = { capture: c, analyzing: false, error: null };
      });
      return next;
    });
  }, []);

  async function handleFile(slot: CaptureSlot, file: File) {
    setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: true, error: null } }));
    try {
      const imageData = await compressImage(file);
      const res = await fetch("/api/analyze-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData }),
      });
      if (!res.ok) throw new Error("분석 실패");
      const analysis: CaptureAnalysis = await res.json();
      const capture: Capture = { slot, imageData, analysis, capturedAt: new Date().toISOString() };
      saveCapture(capture);
      setSlots((prev) => ({ ...prev, [slot]: { capture, analyzing: false, error: null } }));
      // Auto-generate briefing after analysis
      await generateBriefing(capture);
    } catch {
      setSlots((prev) => ({ ...prev, [slot]: { ...prev[slot], analyzing: false, error: "분석 실패. 다시 시도해주세요." } }));
    }
  }

  async function generateBriefing(newCapture?: Capture) {
    setBriefingLoading(true);
    setBriefingDone(false);
    try {
      const allCaptures = getTodayCaptures();
      if (newCapture) {
        const exists = allCaptures.find((c) => c.slot === newCapture.slot);
        if (!exists) allCaptures.push(newCapture);
      }
      const capturedStocks = allCaptures.map((c) => c.analysis).filter(Boolean);
      const stocks = getStocks();
      const res = await fetch("/api/generate-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stocks,
          capturedStocks: capturedStocks.length > 0 ? capturedStocks : undefined,
          useWebSearch: true,
        }),
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
    setBriefingDone(false);
  }

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

              {/* Hidden file input — always rendered */}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={(el) => { fileRefs.current[slot] = el; }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(slot, file);
                  e.target.value = "";
                }}
              />

              {/* Analyzing state */}
              {analyzing && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Loader2 size={28} className="animate-spin text-violet-500" />
                  <p className="text-xs text-gray-400">AI 분석 중...</p>
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
                  </button>
                  {error && (
                    <p className="mt-2 flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle size={12} />{error}
                    </p>
                  )}
                </div>
              )}

              {/* Captured state */}
              {!analyzing && capture && (
                <div className="p-4 flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={capture.imageData}
                    alt="캡처"
                    className="w-20 h-28 object-cover rounded-xl shrink-0 cursor-pointer"
                    onClick={() => window.open(capture.imageData)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-1.5">
                      <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                      <span className="text-xs font-semibold text-emerald-600">분석 완료</span>
                    </div>
                    {capture.analysis?.stockName && (
                      <p className="font-bold text-sm text-gray-900">{capture.analysis.stockName}</p>
                    )}
                    {capture.analysis?.currentPrice && (
                      <p className="text-xs text-gray-600 mt-0.5">{capture.analysis.currentPrice}</p>
                    )}
                    {capture.analysis?.returnRate && (
                      <p className={`text-base font-black mt-0.5 ${
                        capture.analysis.returnRate.startsWith("-") ? "text-blue-600" : "text-red-600"
                      }`}>
                        {capture.analysis.returnRate}
                      </p>
                    )}
                    {capture.analysis?.avgPrice && (
                      <p className="text-xs text-gray-400 mt-0.5">평단 {capture.analysis.avgPrice}</p>
                    )}
                    {capture.analysis?.appType && (
                      <p className="text-[10px] text-gray-300 mt-1">{capture.analysis.appType}</p>
                    )}
                    <button
                      onClick={() => fileRefs.current[slot]?.click()}
                      className="mt-2 text-xs text-violet-500 underline"
                    >
                      다시 업로드
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
