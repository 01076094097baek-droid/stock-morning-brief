"use client";

import { useState, useEffect } from "react";
import { getBriefing } from "@/lib/storage";
import { NewsItem } from "@/lib/types";
import { ExternalLink, Newspaper } from "lucide-react";

type Filter = "ALL" | "KR" | "US" | "MACRO";

export default function NewsTab() {
  const [news,   setNews]   = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    const briefing = getBriefing();
    setNews(briefing?.news ?? []);
  }, []);

  const filtered = filter === "ALL" ? news : news.filter((n) => n.category === filter);

  return (
    <div className="pb-6">
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <span className="font-semibold text-sm text-gray-900">뉴스</span>
      </div>

      {/* Filter chips */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto">
        {(["ALL", "KR", "US", "MACRO"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${
              filter === f
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white text-gray-500 border-gray-200"
            }`}
          >
            {f === "ALL" ? "전체" : f === "MACRO" ? "매크로" : f}
          </button>
        ))}
      </div>

      <div className="px-4 pb-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Newspaper size={40} className="mx-auto text-gray-200 mb-3" />
            <p className="text-gray-400 text-sm">뉴스가 없어요</p>
            <p className="text-gray-300 text-xs mt-1">브리핑을 먼저 생성해주세요</p>
          </div>
        ) : (
          filtered.map((n) => (
            <div key={n.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-1.5 mb-2">
                {n.stockName && (
                  <span className="text-[10px] font-semibold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded-full">
                    {n.stockName}
                  </span>
                )}
                <span className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded-full">
                  {n.category}
                </span>
                <span className="text-[10px] text-gray-300 ml-auto">{n.source}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 leading-snug mb-1.5">{n.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{n.summary}</p>
              {n.url && n.url !== "#" && (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-violet-600 font-semibold"
                >
                  <ExternalLink size={11} />원문 보기
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
