"use client";

import { useState, useEffect, useRef } from "react";
import { getStocks } from "@/lib/storage";
import { Send, Bot, User, Wifi } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  searched?: boolean;
}

interface AiTabProps {
  initialQuery: string;
  onQueryUsed: () => void;
}

export default function AiTab({ initialQuery, onQueryUsed }: AiTabProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 초기 질문 자동 입력
  useEffect(() => {
    if (initialQuery) {
      setInput(initialQuery);
      onQueryUsed();
      inputRef.current?.focus();
    }
  }, [initialQuery, onQueryUsed]);

  // 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const stocks = getStocks();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stocks,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "응답 실패");
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        searched: data.searched,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: unknown) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: e instanceof Error ? e.message : "오류가 발생했습니다. 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* 헤더 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm">AI 주식 상담</h1>
            <p className="text-xs text-gray-400">실시간 웹 검색 · 내 종목 맞춤 분석</p>
          </div>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-32">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot size={28} className="text-violet-600" />
            </div>
            <p className="text-gray-500 text-sm font-medium mb-1">AI 주식 상담사입니다</p>
            <p className="text-gray-400 text-xs leading-relaxed px-6">
              보유 종목 분석, 시장 동향, 매수·매도 타이밍 등<br />무엇이든 물어보세요
            </p>
            <div className="mt-6 space-y-2">
              {[
                "오늘 시장 전반적인 분위기 알려줘",
                "내 종목 중 리스크가 높은 건 뭐야?",
                "미국 금리 인하가 내 종목에 미치는 영향은?",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="block w-full text-left text-xs text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2 active:bg-violet-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* 아바타 */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "user" ? "bg-gray-200" : "bg-violet-600"
            }`}>
              {msg.role === "user"
                ? <User size={14} className="text-gray-600" />
                : <Bot size={14} className="text-white" />
              }
            </div>

            {/* 말풍선 */}
            <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              {msg.searched && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <Wifi size={10} />
                  실시간 검색 완료
                </div>
              )}
              <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-violet-600 text-white rounded-tr-sm"
                  : "bg-gray-100 text-gray-800 rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-full flex items-center justify-center shrink-0">
              <Bot size={14} className="text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-100 px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="궁금한 점을 물어보세요..."
            rows={1}
            className="flex-1 resize-none border border-gray-200 rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 max-h-28 overflow-y-auto"
            style={{ lineHeight: "1.5" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-violet-600 rounded-full flex items-center justify-center shrink-0 disabled:opacity-40 active:bg-violet-700 transition-colors"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
