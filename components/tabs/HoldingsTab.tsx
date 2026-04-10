"use client";

import { useState, useEffect, useRef } from "react";
import { Stock, DailyBriefing, CaptureSlot } from "@/lib/types";
import { getStocks, getDailyBriefing, saveCapture, getCaptures } from "@/lib/storage";
import { getCountryFlag, getJudgmentStyle, formatPrice, getTodayString } from "@/lib/utils";
import { Plus, CheckCircle, Target, TrendingDown, Camera } from "lucide-react";

const SLOTS: { id: CaptureSlot; label: string }[] = [
  { id: "morning", label: "아침" },
  { id: "midday", label: "장중" },
  { id: "close", label: "마감" },
];

export default function HoldingsTab() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  const [captureMap, setCaptureMap] = useState<Record<string, Record<string, boolean>>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const today = getTodayString();

  useEffect(() => {
    setStocks(getStocks());
    setBriefing(getDailyBriefing());
    loadCaptures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadCaptures() {
    const captures = getCaptures(today);
    const map: Record<string, Record<string, boolean>> = {};
    captures.forEach((sc) => {
      map[sc.stockId] = {};
      Object.keys(sc.captures).forEach((slot) => {
        map[sc.stockId][slot] = true;
      });
    });
    setCaptureMap(map);
  }

  async function handleUpload(stockId: string, slot: CaptureSlot, file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageData = e.target?.result as string;
      saveCapture(today, stockId, slot, imageData);
      loadCaptures();

      // Claude Vision 분석 (백그라운드)
      try {
        await fetch("/api/analyze-capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stockId, slot, imageData }),
        });
      } catch {
        // 분석 실패해도 무시
      }
    };
    reader.readAsDataURL(file);
  }

  if (stocks.length === 0) {
    return (
      <div className="tab-content flex flex-col items-center justify-center py-20">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-gray-400 text-sm">등록된 종목이 없어요</p>
        <p className="text-gray-300 text-xs mt-1">내 종목 탭에서 먼저 종목을 추가해보세요</p>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <h1 className="font-bold text-gray-900">보유종목 현황</h1>
        <p className="text-xs text-gray-400 mt-0.5">{today} · 캡처 업로드로 현황 기록</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {stocks.map((stock) => {
          const sb = briefing?.stockBriefings.find((b) => b.stockId === stock.id);
          const judgStyle = sb ? getJudgmentStyle(sb.judgment) : null;
          const captures = captureMap[stock.id] || {};

          return (
            <div key={stock.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
              {/* 상단: 종목 정보 */}
              <div className="px-4 pt-4 pb-3 border-b border-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{getCountryFlag(stock.country)}</span>
                    <span className="font-semibold text-sm text-gray-900">{stock.name}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                      {stock.code}
                    </span>
                  </div>
                  {judgStyle && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${judgStyle.bg} ${judgStyle.text} ${judgStyle.border}`}>
                      {judgStyle.label}
                    </span>
                  )}
                </div>

                {/* 목표가 / 손절가 */}
                {(stock.targetPrice || stock.stopLossPrice) && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {stock.targetPrice && (
                      <div className="bg-emerald-50 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 mb-1">
                          <Target size={10} />
                          목표가
                        </div>
                        <p className="text-sm font-bold text-emerald-700">
                          {formatPrice(stock.targetPrice, stock.currency)}
                        </p>
                      </div>
                    )}
                    {stock.stopLossPrice && (
                      <div className="bg-red-50 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-red-500 mb-1">
                          <TrendingDown size={10} />
                          손절가
                        </div>
                        <p className="text-sm font-bold text-red-600">
                          {formatPrice(stock.stopLossPrice, stock.currency)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 하단: 캡처 슬롯 */}
              <div className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Camera size={12} className="text-gray-400" />
                  <span className="text-xs font-medium text-gray-500">시세 캡처</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SLOTS.map((slot) => {
                    const isDone = captures[slot.id];
                    const inputKey = `${stock.id}_${slot.id}`;
                    return (
                      <div key={slot.id}>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          ref={(el) => { fileRefs.current[inputKey] = el; }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUpload(stock.id, slot.id, f);
                          }}
                        />
                        <button
                          onClick={() => fileRefs.current[inputKey]?.click()}
                          className={`w-full rounded-lg border-2 border-dashed py-3 flex flex-col items-center gap-1 transition-colors ${
                            isDone
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-gray-200 bg-gray-50 active:bg-gray-100"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle size={18} className="text-emerald-500" />
                          ) : (
                            <Plus size={18} className="text-gray-300" />
                          )}
                          <span className={`text-xs font-medium ${isDone ? "text-emerald-600" : "text-gray-400"}`}>
                            {slot.label}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
