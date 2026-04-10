"use client";

import { useState, useEffect } from "react";
import TabNav from "./TabNav";
import LoginScreen from "./LoginScreen";
import BriefingTab from "./tabs/BriefingTab";
import NewsTab from "./tabs/NewsTab";
import WeeklyTab from "./tabs/WeeklyTab";
import HoldingsTab from "./tabs/HoldingsTab";
import StocksTab from "./tabs/StocksTab";
import AiTab from "./tabs/AiTab";
import { isSessionActive, lockSession } from "@/lib/storage";
import { Lock } from "lucide-react";

export type TabId = "briefing" | "news" | "weekly" | "holdings" | "stocks" | "ai";

export default function AppShell() {
  const [authed, setAuthed] = useState(false);
  const [ready, setReady] = useState(false); // hydration 후 체크
  const [activeTab, setActiveTab] = useState<TabId>("briefing");
  const [highlightStockId, setHighlightStockId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState<string>("");

  useEffect(() => {
    setAuthed(isSessionActive());
    setReady(true);
  }, []);

  function navigateTo(tab: TabId, options?: { stockId?: string; query?: string }) {
    setActiveTab(tab);
    if (options?.stockId) setHighlightStockId(options.stockId);
    if (options?.query) setAiQuery(options.query);
  }

  function handleLock() {
    lockSession();
    setAuthed(false);
  }

  // SSR hydration 전엔 아무것도 렌더링 안 함
  if (!ready) return null;

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="relative">
      {/* 잠금 버튼 (우상단 고정) */}
      <button
        onClick={handleLock}
        className="fixed top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 active:bg-gray-200 transition-colors"
        title="잠금"
      >
        <Lock size={15} />
      </button>

      {activeTab === "briefing" && (
        <BriefingTab onNavigate={navigateTo} />
      )}
      {activeTab === "news" && (
        <NewsTab highlightStockId={highlightStockId} onClearHighlight={() => setHighlightStockId(null)} />
      )}
      {activeTab === "weekly" && <WeeklyTab />}
      {activeTab === "holdings" && <HoldingsTab />}
      {activeTab === "stocks" && (
        <StocksTab onLock={handleLock} />
      )}
      {activeTab === "ai" && (
        <AiTab initialQuery={aiQuery} onQueryUsed={() => setAiQuery("")} />
      )}
      <TabNav activeTab={activeTab} onTabChange={(tab) => navigateTo(tab)} />
    </div>
  );
}
