"use client";

import { useState, useEffect, useRef } from "react";
import { NewsItem } from "@/lib/types";
import { getDailyBriefing } from "@/lib/storage";
import { getNewsCategoryStyle, formatTime } from "@/lib/utils";
import { ExternalLink, Newspaper } from "lucide-react";

interface NewsTabProps {
  highlightStockId: string | null;
  onClearHighlight: () => void;
}

export default function NewsTab({ highlightStockId, onClearHighlight }: NewsTabProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<"ALL" | "KR" | "US" | "MACRO">("ALL");
  const highlightRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const briefing = getDailyBriefing();
    if (briefing) setNews(briefing.news);
  }, []);

  useEffect(() => {
    if (highlightStockId) {
      const el = highlightRefs.current[highlightStockId];
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }
      const timer = setTimeout(onClearHighlight, 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightStockId, onClearHighlight]);

  const filtered = news.filter((n) => filter === "ALL" || n.category === filter);

  return (
    <div className="tab-content">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
        <div className="px-4 py-3">
          <h1 className="font-bold text-gray-900">관련 뉴스</h1>
        </div>
        {/* 필터 탭 */}
        <div className="flex px-4 pb-3 gap-2">
          {(["ALL", "KR", "US", "MACRO"] as const).map((f) => {
            const labels = { ALL: "전체", KR: "🇰🇷 한국", US: "🇺🇸 미국", MACRO: "매크로" };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                  filter === f
                    ? "bg-violet-600 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {labels[f]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Newspaper size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">
              {news.length === 0
                ? "브리핑을 생성하면 뉴스가 표시됩니다"
                : "해당 카테고리의 뉴스가 없어요"}
            </p>
          </div>
        )}

        {filtered.map((item) => {
          const catStyle = getNewsCategoryStyle(item.category);
          const isHighlighted = item.stockId === highlightStockId;

          return (
            <div
              key={item.id}
              ref={(el) => {
                if (item.stockId) highlightRefs.current[item.stockId] = el;
              }}
              className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
                isHighlighted
                  ? "border-violet-300 ring-2 ring-violet-100"
                  : "border-gray-100"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${catStyle.bg} ${catStyle.text}`}
                >
                  {catStyle.label}
                </span>
                {item.stockName && (
                  <span className="text-xs text-gray-400">{item.stockName}</span>
                )}
                <span className="text-xs text-gray-300 ml-auto">
                  {formatTime(item.publishedAt)}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-gray-800 leading-snug mb-1">
                {item.title}
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                {item.summary}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-gray-300">{item.source}</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-violet-600 font-medium"
                >
                  기사 원문 보기
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
