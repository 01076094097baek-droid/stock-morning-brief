"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Stock, DailyBriefing, CaptureSlot, Capture, CaptureAnalysis } from "@/lib/types";
import {
  getStocks,
  getDailyBriefing,
  saveCapture,
  saveCaptureAnalysis,
  getCaptures,
} from "@/lib/storage";
import {
  getCountryFlag,
  getJudgmentStyle,
  formatPrice,
  getTodayString,
} from "@/lib/utils";
import {
  Plus,
  CheckCircle,
  Target,
  TrendingDown,
  Camera,
  RefreshCw,
  TrendingUp,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";

const SLOTS: { id: CaptureSlot; label: string; time: string }[] = [
  { id: "morning", label: "아침", time: "09:00" },
  { id: "midday", label: "장중", time: "13:00" },
  { id: "close", label: "마감", time: "15:30" },
];

// 이미지를 최대 800px로 압축 (localStorage 절약)
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 900;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

type CaptureState = Partial<Record<CaptureSlot, Capture>>;
type AnalyzingState = Partial<Record<CaptureSlot, boolean>>;

export default function HoldingsTab() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);
  // stockId → slot → Capture
  const [captureData, setCaptureData] = useState<Record<string, CaptureState>>({});
  // stockId → slot → analyzing
  const [analyzing, setAnalyzing] = useState<Record<string, AnalyzingState>>({});
  // 이미지 전체화면 뷰어
  const [viewer, setViewer] = useState<{ src: string; label: string } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const today = getTodayString();

  const loadCaptures = useCallback(() => {
    const all = getCaptures(today);
    const map: Record<string, CaptureState> = {};
    all.forEach((sc) => { map[sc.stockId] = sc.captures; });
    setCaptureData(map);
  }, [today]);

  useEffect(() => {
    setStocks(getStocks());
    setBriefing(getDailyBriefing());
    loadCaptures();
  }, [loadCaptures]);

  async function handleUpload(stock: Stock, slot: CaptureSlot, file: File) {
    const key = `${stock.id}_${slot}`;

    // 1. 이미지 압축
    const imageData = await compressImage(file);

    // 2. 즉시 저장 & UI 반영
    saveCapture(today, stock.id, slot, imageData);
    loadCaptures();

    // 3. 분석 시작 표시
    setAnalyzing((prev) => ({
      ...prev,
      [stock.id]: { ...prev[stock.id], [slot]: true },
    }));

    // 4. Claude Vision 분석 요청
    try {
      const res = await fetch("/api/analyze-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockId: stock.id, slot, imageData, stockName: stock.name }),
      });

      if (res.ok) {
        const data = await res.json();
        const analysis: CaptureAnalysis = data.analysis || {};
        saveCaptureAnalysis(today, stock.id, slot, analysis);
        loadCaptures();
      }
    } catch {
      // 분석 실패는 조용히 처리
    } finally {
      setAnalyzing((prev) => ({
        ...prev,
        [stock.id]: { ...prev[stock.id], [slot]: false },
      }));
    }

    // 파일 input 초기화 (같은 파일 재업로드 허용)
    const input = fileRefs.current[key];
    if (input) input.value = "";
  }

  if (stocks.length === 0) {
    return (
      <div className="tab-content flex flex-col items-center justify-center py-24">
        <div className="text-5xl mb-4">📊</div>
        <p className="text-gray-500 font-medium">등록된 종목이 없어요</p>
        <p className="text-gray-300 text-sm mt-1">내 종목 탭에서 먼저 종목을 추가해보세요</p>
      </div>
    );
  }

  return (
    <>
      <div className="tab-content">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
          <h1 className="font-bold text-gray-900">보유종목 현황</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {today} · 캡처 업로드 → Claude Vision 자동 분석
          </p>
        </div>

        <div className="px-4 py-4 space-y-5">
          {stocks.map((stock) => {
            const sb = briefing?.stockBriefings.find((b) => b.stockId === stock.id);
            const judgStyle = sb ? getJudgmentStyle(sb.judgment) : null;
            const stockCaptures = captureData[stock.id] || {};
            const stockAnalyzing = analyzing[stock.id] || {};

            // 가장 최신 분석 (마감 > 장중 > 아침)
            const latestAnalysis: CaptureAnalysis | null =
              stockCaptures.close?.analysis ??
              stockCaptures.midday?.analysis ??
              stockCaptures.morning?.analysis ??
              null;

            return (
              <div key={stock.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                {/* ── 종목 헤더 ── */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getCountryFlag(stock.country)}</span>
                      <div>
                        <span className="font-bold text-sm text-gray-900">{stock.name}</span>
                        <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          {stock.code}
                        </span>
                      </div>
                    </div>
                    {judgStyle && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${judgStyle.bg} ${judgStyle.text} ${judgStyle.border}`}>
                        {judgStyle.label}
                      </span>
                    )}
                  </div>

                  {/* ── 캡처 분석 결과 요약 ── */}
                  {latestAnalysis && (
                    <div className="mt-3 bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl p-3 border border-violet-100">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Camera size={11} className="text-violet-500" />
                        <span className="text-xs font-semibold text-violet-700">Vision 분석 결과</span>
                        {latestAnalysis.appType && (
                          <span className="text-xs text-violet-400">· {latestAnalysis.appType}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {latestAnalysis.currentPrice && (
                          <AnalysisCell label="현재가" value={latestAnalysis.currentPrice} />
                        )}
                        {latestAnalysis.changeRate && (
                          <AnalysisCell
                            label="등락률"
                            value={latestAnalysis.changeRate}
                            color={latestAnalysis.changeRate.startsWith("+") ? "text-red-600" : latestAnalysis.changeRate.startsWith("-") ? "text-blue-600" : "text-gray-700"}
                          />
                        )}
                        {latestAnalysis.avgPrice && (
                          <AnalysisCell label="평단가" value={latestAnalysis.avgPrice} />
                        )}
                        {latestAnalysis.returnRate && (
                          <AnalysisCell
                            label="수익률"
                            value={latestAnalysis.returnRate}
                            color={latestAnalysis.returnRate.startsWith("+") ? "text-red-600" : latestAnalysis.returnRate.startsWith("-") ? "text-blue-600" : "text-gray-700"}
                            bold
                          />
                        )}
                        {latestAnalysis.evaluationAmount && (
                          <AnalysisCell label="평가금액" value={latestAnalysis.evaluationAmount} />
                        )}
                        {latestAnalysis.quantity && (
                          <AnalysisCell label="보유수량" value={latestAnalysis.quantity} />
                        )}
                      </div>
                      {latestAnalysis.analysisText && (
                        <p className="mt-2 text-xs text-violet-600 leading-relaxed border-t border-violet-100 pt-2">
                          {latestAnalysis.analysisText}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── 목표가 / 손절가 ── */}
                  {(stock.targetPrice || stock.stopLossPrice) && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      {stock.targetPrice && (
                        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 mb-1">
                            <Target size={10} /> 목표가
                          </div>
                          <p className="text-sm font-bold text-emerald-700">
                            {formatPrice(stock.targetPrice, stock.currency)}
                          </p>
                        </div>
                      )}
                      {stock.stopLossPrice && (
                        <div className="bg-red-50 rounded-xl p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-red-500 mb-1">
                            <TrendingDown size={10} /> 손절가
                          </div>
                          <p className="text-sm font-bold text-red-600">
                            {formatPrice(stock.stopLossPrice, stock.currency)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── 캡처 슬롯 ── */}
                <div className="border-t border-gray-50 px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Camera size={12} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500">시세 캡처</span>
                    <span className="text-xs text-gray-300">· 업로드하면 AI가 자동 분석</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {SLOTS.map((slot) => {
                      const capture = stockCaptures[slot.id];
                      const isAnalyzing = stockAnalyzing[slot.id];
                      const isDone = !!capture;
                      const inputKey = `${stock.id}_${slot.id}`;

                      return (
                        <div key={slot.id}>
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            ref={(el) => { fileRefs.current[inputKey] = el; }}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(stock, slot.id, f);
                            }}
                          />
                          <div
                            className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
                              isDone
                                ? "border-violet-200"
                                : "border-dashed border-gray-200"
                            }`}
                            style={{ aspectRatio: "3/4" }}
                            onClick={() => {
                              if (isDone && capture?.imageData && !isAnalyzing) {
                                // 탭: 이미지 뷰어
                                setViewer({ src: capture.imageData, label: `${stock.name} · ${slot.label}` });
                              } else if (!isAnalyzing) {
                                fileRefs.current[inputKey]?.click();
                              }
                            }}
                          >
                            {/* 이미지 미리보기 */}
                            {isDone && capture?.imageData ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={capture.imageData}
                                alt={`${stock.name} ${slot.label} 캡처`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center gap-1">
                                <ImageIcon size={20} className="text-gray-300" />
                              </div>
                            )}

                            {/* 분석 중 오버레이 */}
                            {isAnalyzing && (
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1.5">
                                <Loader2 size={18} className="text-white animate-spin" />
                                <span className="text-white text-[10px] font-medium">분석 중</span>
                              </div>
                            )}

                            {/* 완료 뱃지 */}
                            {isDone && !isAnalyzing && (
                              <div className="absolute top-1.5 right-1.5">
                                {capture?.analysis ? (
                                  <div className="bg-violet-500 rounded-full p-0.5">
                                    <CheckCircle size={12} className="text-white" />
                                  </div>
                                ) : (
                                  <div className="bg-emerald-500 rounded-full p-0.5">
                                    <CheckCircle size={12} className="text-white" />
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 재업로드 버튼 (완료 상태) */}
                            {isDone && !isAnalyzing && (
                              <button
                                className="absolute bottom-1.5 right-1.5 bg-black/50 rounded-full p-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileRefs.current[inputKey]?.click();
                                }}
                              >
                                <RefreshCw size={10} className="text-white" />
                              </button>
                            )}

                            {/* 업로드 버튼 (빈 상태) */}
                            {!isDone && !isAnalyzing && (
                              <button
                                className="absolute bottom-1.5 right-1.5 bg-violet-500 rounded-full p-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  fileRefs.current[inputKey]?.click();
                                }}
                              >
                                <Plus size={11} className="text-white" />
                              </button>
                            )}
                          </div>

                          {/* 슬롯 라벨 + 분석 미니 결과 */}
                          <div className="mt-1.5 text-center">
                            <p className={`text-xs font-medium ${isDone ? "text-violet-600" : "text-gray-400"}`}>
                              {slot.label}
                            </p>
                            {capture?.analysis?.currentPrice && (
                              <p className="text-[10px] text-gray-500 truncate">
                                {capture.analysis.currentPrice}
                              </p>
                            )}
                            {capture?.analysis?.returnRate && (
                              <p className={`text-[10px] font-semibold ${
                                capture.analysis.returnRate.startsWith("+") ? "text-red-500" : "text-blue-500"
                              }`}>
                                {capture.analysis.returnRate}
                              </p>
                            )}
                            {isAnalyzing && (
                              <p className="text-[10px] text-violet-400">분석 중...</p>
                            )}
                          </div>
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

      {/* ── 이미지 전체화면 뷰어 ── */}
      {viewer && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setViewer(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <span className="text-sm font-medium">{viewer.label}</span>
            <button onClick={() => setViewer(null)} className="p-1">
              <X size={22} className="text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewer.src}
              alt={viewer.label}
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  );
}

function AnalysisCell({
  label,
  value,
  color = "text-gray-800",
  bold = false,
}: {
  label: string;
  value: string;
  color?: string;
  bold?: boolean;
}) {
  return (
    <div className="bg-white/70 rounded-lg px-2.5 py-1.5">
      <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
      <p className={`text-xs ${bold ? "font-bold" : "font-semibold"} ${color} truncate`}>
        {value}
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _TrendingUpIcon() { return <TrendingUp size={10} />; }
