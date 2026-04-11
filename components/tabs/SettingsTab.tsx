"use client";

import { useState, useEffect } from "react";
import { getStocks, saveStocks, verifyPin, setPin as savePin } from "@/lib/storage";
import { Stock } from "@/lib/types";
import { Plus, Trash2, Bell, BellOff, ChevronDown, ChevronUp } from "lucide-react";

export default function SettingsTab() {
  const [stocks,      setStocks]      = useState<Stock[]>([]);
  const [form,        setForm]        = useState({ name: "", code: "", country: "KR" as "KR" | "US" });
  const [pushOn,      setPushOn]      = useState(false);
  const [pinOpen,     setPinOpen]     = useState(false);
  const [pinForm,     setPinForm]     = useState({ cur: "", next: "", confirm: "" });
  const [pinMsg,      setPinMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [pushLoading, setPushLoading] = useState(false);

  useEffect(() => {
    setStocks(getStocks());
    setPushOn(localStorage.getItem("smb_push_enabled") === "1");
  }, []);

  function syncKv(updated: Stock[]) {
    fetch("/api/stocks/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: updated }),
    }).catch(() => {});
  }

  function addStock() {
    if (!form.name.trim() || !form.code.trim()) return;
    const updated = [...stocks, { id: `s_${Date.now()}`, ...form }];
    saveStocks(updated);
    setStocks(updated);
    setForm({ name: "", code: "", country: "KR" });
    syncKv(updated);
  }

  function removeStock(id: string) {
    const updated = stocks.filter((s) => s.id !== id);
    saveStocks(updated);
    setStocks(updated);
    syncKv(updated);
  }

  async function togglePush() {
    if (pushLoading) return;
    if (!pushOn) {
      setPushLoading(true);
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { setPushLoading(false); return; }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        });
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        localStorage.setItem("smb_push_enabled", "1");
        setPushOn(true);
      } catch {
        // Ignore — push not supported or denied
      } finally {
        setPushLoading(false);
      }
    } else {
      localStorage.setItem("smb_push_enabled", "0");
      setPushOn(false);
    }
  }

  async function changePin() {
    if (pinForm.next !== pinForm.confirm) {
      setPinMsg({ ok: false, text: "새 PIN이 일치하지 않습니다" }); return;
    }
    if (pinForm.next.length !== 4) {
      setPinMsg({ ok: false, text: "PIN은 4자리여야 합니다" }); return;
    }
    const ok = await verifyPin(pinForm.cur);
    if (!ok) { setPinMsg({ ok: false, text: "현재 PIN이 틀렸습니다" }); return; }
    await savePin(pinForm.next);
    setPinForm({ cur: "", next: "", confirm: "" });
    setPinMsg({ ok: true, text: "PIN이 변경되었습니다" });
    setTimeout(() => setPinMsg(null), 2500);
  }

  return (
    <div className="pb-6">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <span className="font-semibold text-sm text-gray-900">설정</span>
      </div>

      <div className="px-4 py-5 space-y-7">
        {/* ── 종목 관리 ── */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">
            내 종목 ({stocks.length})
          </p>

          {stocks.length > 0 && (
            <div className="space-y-2 mb-3">
              {stocks.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 truncate">{s.name}</span>
                    <span className="text-xs text-gray-400 shrink-0">{s.code}</span>
                    <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      s.country === "KR" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    }`}>
                      {s.country}
                    </span>
                  </div>
                  <button onClick={() => removeStock(s.id)} className="p-1.5 text-gray-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
            <div className="flex gap-2">
              <input
                placeholder="종목명"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addStock()}
                className="flex-1 min-w-0 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-violet-400"
              />
              <input
                placeholder="코드/티커"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addStock()}
                className="w-28 text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-violet-400"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as "KR" | "US" }))}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-violet-400"
              >
                <option value="KR">한국</option>
                <option value="US">미국</option>
              </select>
              <button
                onClick={addStock}
                className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 text-white text-sm font-semibold rounded-xl py-2.5"
              >
                <Plus size={15} />추가
              </button>
            </div>
          </div>
        </section>

        {/* ── 알림 ── */}
        <section>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">알림</p>
          <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              {pushOn
                ? <Bell size={18} className="text-violet-600" />
                : <BellOff size={18} className="text-gray-400" />}
              <div>
                <p className="text-sm font-semibold text-gray-900">브리핑 알림</p>
                <p className="text-xs text-gray-400">매일 08:00 자동 알림</p>
              </div>
            </div>
            {/* Toggle */}
            <button
              onClick={togglePush}
              disabled={pushLoading}
              className={`relative w-12 h-6 rounded-full transition-colors ${pushOn ? "bg-violet-600" : "bg-gray-200"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${pushOn ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </section>

        {/* ── PIN 변경 ── */}
        <section>
          <button
            onClick={() => setPinOpen((o) => !o)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3"
          >
            <span>PIN 변경</span>
            {pinOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {pinOpen && (
            <div className="bg-gray-50 rounded-2xl p-3 space-y-2">
              {[
                { key: "cur",     label: "현재 PIN" },
                { key: "next",    label: "새 PIN" },
                { key: "confirm", label: "새 PIN 확인" },
              ].map(({ key, label }) => (
                <input
                  key={key}
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  placeholder={label}
                  value={pinForm[key as keyof typeof pinForm]}
                  onChange={(e) => setPinForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 bg-white outline-none focus:border-violet-400"
                />
              ))}
              {pinMsg && (
                <p className={`text-xs ${pinMsg.ok ? "text-emerald-600" : "text-red-500"}`}>
                  {pinMsg.text}
                </p>
              )}
              <button
                onClick={changePin}
                className="w-full bg-violet-600 text-white text-sm font-semibold py-2.5 rounded-xl"
              >
                변경하기
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
