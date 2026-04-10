"use client";

import { TabId } from "./AppShell";
import {
  Newspaper,
  TrendingUp,
  CalendarDays,
  BarChart2,
  ListChecks,
  MessageSquare,
} from "lucide-react";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "briefing", label: "브리핑", icon: <Newspaper size={20} /> },
  { id: "news", label: "뉴스", icon: <TrendingUp size={20} /> },
  { id: "weekly", label: "주간이슈", icon: <CalendarDays size={20} /> },
  { id: "holdings", label: "보유종목", icon: <BarChart2 size={20} /> },
  { id: "stocks", label: "내종목", icon: <ListChecks size={20} /> },
  { id: "ai", label: "AI상담", icon: <MessageSquare size={20} /> },
];

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabNav({ activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                isActive
                  ? "text-violet-600"
                  : "text-gray-400 active:text-gray-600"
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium leading-tight">
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute top-0 left-0 w-full h-0.5 bg-violet-600" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
