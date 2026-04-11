"use client";

import { useState, useEffect } from "react";
import { Stock } from "@/lib/types";
import { getStocks, addStock, removeStock, resetPin, setHint, getHintQuestion } from "@/lib/storage";
import { generateId, getCountryFlag, formatPrice } from "@/lib/utils";
import { Plus, Trash2, Target, TrendingDown, KeyRound, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function StocksTab({ onLock }: { onLock?: () => void }) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Stock>>({ country: "KR", currency: "KRW" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPinSection, setShowPinSection] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHintSection, setShowHintSection] = useState(false);
  const [hintVerifyPin, setHintVerifyPin] = useState("");
  const [newHintQ, setNewHintQ] = useState("");
  const [newHintA, setNewHintA] = useState("");
  const [hintMsg, setHintMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [currentHintQ, setCurrentHintQ] = useState<string | null>(null);

  useEffect(() => {
    setStocks(getStocks());
    setCurrentHintQ(getHintQuestion());
  }, []);

  function handleCountryChange(country: "KR" | "US") {
    setForm((prev) => ({
      ...prev,
      country,
      currency: country === "KR" ? "KRW" : "USD",
    }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "종목명을 입력해주세요";
    if (!form.code?.trim()) e.code = "종목코드를 입력해주세요";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAdd() {
    if (!validate()) return;
    const newStock: Stock = {
      id: generateId(),
      name: form.name!.trim(),
      code: form.code!.trim().toUpperCase(),
      country: form.country as "KR" | "US",
      currency: form.currency as "KRW" | "USD",
      targetPrice: form.targetPrice ? Number(form.targetPrice) : undefined,
      stopLossPrice: form.stopLossPrice ? Number(form.stopLossPrice) : undefined,
    };
    addStock(newStock);
    const updated = getStocks();
    setStocks(updated);
    syncToKv(updated);
    setForm({ country: "KR", currency: "KRW" });
    setShowForm(false);
    setErrors({});
  }

  function handleRemove(id: string) {
    if (!confirm("이 종목을 삭제할까요?")) return;
    removeStock(id);
    const updated = getStocks();
    setStocks(updated);
    syncToKv(updated);
  }

  // 종목 변경 시 KV 동기화 (백그라운드, 실패 무시)
  function syncToKv(stockList: import("@/lib/types").Stock[]) {
    fetch("/api/stocks/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: stockList }),
    }).catch(() => {});
  }

  const krStocks = stocks.filter((s) => s.country === "KR");
  const usStocks = stocks.filter((s) => s.country === "US");

  return (
    <div className="tab-content">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-gray-900">내 종목 설정</h1>
          <button
            onClick={() => { setShowForm(!showForm); setErrors({}); }}
            className="flex items-center gap-1 bg-violet-600 text-white text-sm font-medium px-3 py-1.5 rounded-full active:bg-violet-700"
          >
            <Plus size={14} />
            종목 추가
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* 추가 폼 */}
        {showForm && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-sm text-violet-800">새 종목 추가</h3>

            {/* 국가 선택 */}
            <div className="flex gap-2">
              {(["KR", "US"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => handleCountryChange(c)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    form.country === c
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {getCountryFlag(c)}
                  {c === "KR" ? "한국주식" : "미국주식"}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div>
                <input
                  placeholder={form.country === "KR" ? "종목명 (예: 삼성전자)" : "종목명 (예: Apple)"}
                  value={form.name || ""}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 ${
                    errors.name ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
                  }`}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <input
                  placeholder={form.country === "KR" ? "종목코드 (예: 005930)" : "티커 (예: AAPL)"}
                  value={form.code || ""}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  className={`w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 ${
                    errors.code ? "border-red-300 bg-red-50" : "border-gray-200 bg-white"
                  }`}
                />
                {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder={form.country === "KR" ? "목표가 (원)" : "목표가 ($)"}
                  value={form.targetPrice || ""}
                  onChange={(e) => setForm((p) => ({ ...p, targetPrice: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                />
                <input
                  type="number"
                  placeholder={form.country === "KR" ? "손절가 (원)" : "손절가 ($)"}
                  value={form.stopLossPrice || ""}
                  onChange={(e) => setForm((p) => ({ ...p, stopLossPrice: Number(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 bg-white"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setErrors({}); }}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 bg-white"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
              >
                추가
              </button>
            </div>
          </div>
        )}

        {/* 한국 주식 */}
        <StockSection
          title="🇰🇷 한국 주식"
          stocks={krStocks}
          onRemove={handleRemove}
        />

        {/* 미국 주식 */}
        <StockSection
          title="🇺🇸 미국 주식"
          stocks={usStocks}
          onRemove={handleRemove}
        />

        {stocks.length === 0 && !showForm && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-400 text-sm">등록된 종목이 없어요</p>
            <p className="text-gray-300 text-xs mt-1">위 버튼으로 종목을 추가해보세요</p>
          </div>
        )}

        {/* PIN 변경 섹션 */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => { setShowPinSection(!showPinSection); setPinMsg(null); }}
            className="w-full flex items-center justify-between px-4 py-3 bg-white active:bg-gray-50"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <KeyRound size={15} className="text-gray-400" />
              PIN 변경
            </div>
            {showPinSection ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>

          {showPinSection && (
            <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-3 bg-white">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="현재 PIN (4자리)"
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 tracking-widest text-center"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="새 PIN (4자리)"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 tracking-widest text-center"
              />
              {pinMsg && (
                <p className={`text-xs text-center ${pinMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {pinMsg.text}
                </p>
              )}
              <button
                onClick={async () => {
                  if (oldPin.length !== 4 || newPin.length !== 4) {
                    setPinMsg({ ok: false, text: "PIN은 4자리여야 합니다" });
                    return;
                  }
                  const ok = await resetPin(oldPin, newPin);
                  if (ok) {
                    setPinMsg({ ok: true, text: "PIN이 변경되었습니다" });
                    setOldPin(""); setNewPin("");
                    setTimeout(() => { setShowPinSection(false); setPinMsg(null); }, 1500);
                  } else {
                    setPinMsg({ ok: false, text: "현재 PIN이 올바르지 않습니다" });
                    setOldPin("");
                  }
                }}
                className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
              >
                PIN 변경
              </button>
            </div>
          )}
        </div>

        {/* 힌트 질문 변경 섹션 */}
        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <button
            onClick={() => { setShowHintSection(!showHintSection); setHintMsg(null); }}
            className="w-full flex items-center justify-between px-4 py-3 bg-white active:bg-gray-50"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <HelpCircle size={15} className="text-gray-400" />
              힌트 질문 {currentHintQ ? "변경" : "등록"}
            </div>
            {showHintSection ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
          </button>

          {showHintSection && (
            <div className="px-4 pb-4 border-t border-gray-50 pt-3 bg-white space-y-2">
              {currentHintQ && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-gray-400 mb-0.5">현재 질문</p>
                  <p className="text-sm text-gray-600 font-medium">{currentHintQ}</p>
                </div>
              )}
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="현재 PIN 확인 (4자리)"
                value={hintVerifyPin}
                onChange={(e) => setHintVerifyPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300 tracking-widest text-center"
              />
              <input
                placeholder="새 힌트 질문"
                value={newHintQ}
                onChange={(e) => setNewHintQ(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              <input
                placeholder="새 힌트 답변"
                value={newHintA}
                onChange={(e) => setNewHintA(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-300"
              />
              {hintMsg && (
                <p className={`text-xs text-center ${hintMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {hintMsg.text}
                </p>
              )}
              <button
                onClick={async () => {
                  if (hintVerifyPin.length !== 4) { setHintMsg({ ok: false, text: "PIN을 입력해주세요" }); return; }
                  if (!newHintQ.trim() || !newHintA.trim()) { setHintMsg({ ok: false, text: "질문과 답변을 모두 입력해주세요" }); return; }
                  const { verifyPin } = await import("@/lib/storage");
                  const ok = await verifyPin(hintVerifyPin);
                  if (!ok) { setHintMsg({ ok: false, text: "PIN이 올바르지 않습니다" }); setHintVerifyPin(""); return; }
                  await setHint(newHintQ.trim(), newHintA.trim());
                  setCurrentHintQ(newHintQ.trim());
                  setHintMsg({ ok: true, text: "힌트 질문이 변경되었습니다" });
                  setHintVerifyPin(""); setNewHintQ(""); setNewHintA("");
                  setTimeout(() => { setShowHintSection(false); setHintMsg(null); }, 1500);
                }}
                className="w-full py-2 rounded-lg bg-violet-600 text-white text-sm font-medium"
              >
                저장
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StockSection({
  title,
  stocks,
  onRemove,
}: {
  title: string;
  stocks: Stock[];
  onRemove: (id: string) => void;
}) {
  if (stocks.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-bold text-gray-700 mb-3">{title}</h2>
      <div className="space-y-2">
        {stocks.map((stock) => (
          <div
            key={stock.id}
            className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-gray-900">
                    {stock.name}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                    {stock.code}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 mt-2">
                  {stock.targetPrice && (
                    <div className="flex items-center gap-1 text-xs text-emerald-600">
                      <Target size={11} />
                      목표 {formatPrice(stock.targetPrice, stock.currency)}
                    </div>
                  )}
                  {stock.stopLossPrice && (
                    <div className="flex items-center gap-1 text-xs text-red-500">
                      <TrendingDown size={11} />
                      손절 {formatPrice(stock.stopLossPrice, stock.currency)}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRemove(stock.id)}
                className="p-1.5 text-gray-300 active:text-red-400 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
