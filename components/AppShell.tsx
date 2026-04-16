"use client";

import { useState, useEffect } from "react";
import { isSessionActive, lockSession } from "@/lib/storage";
import LoginScreen from "./LoginScreen";
import BriefingTab from "./tabs/BriefingTab";
import NewsTab from "./tabs/NewsTab";
import CaptureTab from "./tabs/CaptureTab";
import SettingsTab from "./tabs/SettingsTab";
import StatsTab from "./tabs/StatsTab";
import { LayoutDashboard, Newspaper, Camera, Settings, Lock, BarChart2 } from "lucide-react";

type Tab = "briefing" | "news" | "capture" | "stats" | "settings";

const TABS = [
  { id: "briefing",  label: "브리핑", Icon: LayoutDashboard },
  { id: "capture",   label: "캡처",   Icon: Camera },
  { id: "stats",     label: "통계",   Icon: BarChart2 },
  { id: "news",      label: "뉴스",   Icon: Newspaper },
  { id: "settings",  label: "설정",   Icon: Settings },
] as const;

export default function AppShell() {
  const [ready,  setReady]  = useState(false);
  const [authed, setAuthed] = useState(false);
  const [tab,    setTab]    = useState<Tab>("briefing");

  useEffect(() => {
    setAuthed(isSessionActive());
    setReady(true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  if (!ready)  return null;
  if (!authed) return <LoginScreen onSuccess={() => setAuthed(true)} />;

  return (
    <div className="flex flex-col h-screen">
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <span className="font-bold text-gray-900">주식 모닝 브리핑</span>
        <button
          onClick={() => { lockSession(); setAuthed(false); }}
          className="p-1.5 rounded-full text-gray-400 hover:bg-gray-50"
        >
          <Lock size={16} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto">
        {tab === "briefing" && <BriefingTab />}
        {tab === "capture"  && <CaptureTab onDone={() => setTab("briefing")} />}
        {tab === "stats"    && <StatsTab />}
        {tab === "news"     && <NewsTab />}
        {tab === "settings" && <SettingsTab />}
      </main>

      <nav className="border-t border-gray-100 bg-white shrink-0">
        <div className="flex">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id as Tab)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 ${
                  active ? "text-violet-600" : "text-gray-400"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
