"use client";

import { useState } from "react";
import TabNav from "./TabNav";
import BriefingTab from "./tabs/BriefingTab";
import NewsTab from "./tabs/NewsTab";
import WeeklyTab from "./tabs/WeeklyTab";
import HoldingsTab from "./tabs/HoldingsTab";
import StocksTab from "./tabs/StocksTab";
import AiTab from "./tabs/AiTab";

export type TabId = "briefing" | "news" | "weekly" | "holdings" | "stocks" | "ai";

export default function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>("briefing");
  const [highlightStockId, setHighlightStockId] = useState<string | null>(null);
  const [aiQuery, setAiQuery] = useState<string>("");

  function navigateTo(tab: TabId, options?: { stockId?: string; query?: string }) {
    setActiveTab(tab);
    if (options?.stockId) setHighlightStockId(options.stockId);
    if (options?.query) setAiQuery(options.query);
  }

  return (
    <div className="relative">
      {activeTab === "briefing" && (
        <BriefingTab onNavigate={navigateTo} />
      )}
      {activeTab === "news" && (
        <NewsTab highlightStockId={highlightStockId} onClearHighlight={() => setHighlightStockId(null)} />
      )}
      {activeTab === "weekly" && <WeeklyTab />}
      {activeTab === "holdings" && <HoldingsTab />}
      {activeTab === "stocks" && <StocksTab />}
      {activeTab === "ai" && (
        <AiTab initialQuery={aiQuery} onQueryUsed={() => setAiQuery("")} />
      )}
      <TabNav activeTab={activeTab} onTabChange={(tab) => navigateTo(tab)} />
    </div>
  );
}
