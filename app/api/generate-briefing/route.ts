import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Stock, StockBriefing, RecommendedStock, NewsItem, CaptureAnalysis, DailyBriefing } from "@/lib/types";
import { kvSetBriefing } from "@/lib/kv";

export const runtime = "edge";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractFirstJSON(text: string): string | null {
  const clean = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (escape)                { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"')            { inString = !inString; continue; }
    if (inString)              { continue; }
    if (ch === "{")            { depth++; }
    if (ch === "}")            { depth--; if (depth === 0) return clean.slice(start, i + 1); }
  }
  return null;
}

function safeParseJSON(text: string): Record<string, unknown> {
  const jsonStr = extractFirstJSON(text);
  if (!jsonStr) return {};
  try { return JSON.parse(jsonStr); } catch { return {}; }
}

async function callClaude(prompt: string, maxTokens: number): Promise<string> {
  const resp = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return resp.content[0].type === "text" ? resp.content[0].text : "";
}

// 웹 검색 포함 호출 (실시간 시장 데이터 조회)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callClaudeWithSearch(prompt: string, maxTokens: number, maxSearches: number): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (client.beta as any).messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    betas: ["web-search-2025-03-05"],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }],
    messages: [{ role: "user", content: prompt }],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

export async function POST(req: NextRequest) {
  const {
    stocks = [],
    capturedStocks,
    saveToKv = false,
  }: {
    stocks?: Stock[];
    capturedStocks?: CaptureAnalysis[];
    saveToKv?: boolean;
  } = await req.json();

  const today = new Date().toISOString().split("T")[0];
  const now   = new Date().toISOString();

  const useCaptured = capturedStocks && capturedStocks.length > 0;
  const idPrefix    = useCaptured ? "c" : "s";

  const stockList = useCaptured
    ? capturedStocks!.map((c, i) => {
        const parts = [`${idPrefix}${i}: ${c.stockName ?? `종목${i}`}`];
        if (c.currentPrice) parts.push(`현재가 ${c.currentPrice}`);
        if (c.returnRate)   parts.push(`수익률 ${c.returnRate}`);
        if (c.avgPrice)     parts.push(`평단가 ${c.avgPrice}`);
        return parts.join(" | ");
      }).join("\n")
    : stocks.length > 0
    ? stocks.map((s, i) =>
        `${idPrefix}${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "KR" : "US"})` +
        `${s.targetPrice ? ` 목표가:${s.targetPrice}` : ""}` +
        `${s.stopLossPrice ? ` 손절가:${s.stopLossPrice}` : ""}`
      ).join("\n")
    : "등록된 종목 없음";

  const idMap: Record<string, string> = {};
  if (useCaptured) {
    capturedStocks!.forEach((c, i) => { idMap[`c${i}`] = c.stockName ?? `종목${i}`; });
  } else {
    stocks.forEach((s, i) => { idMap[`s${i}`] = s.id; });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

      let marketSummary = "";
      let stockBriefings: StockBriefing[] = [];
      let news: NewsItem[] = [];
      let recommendedStocks: RecommendedStock[] = [];

      try {
        // ── 1단계: 시장 요약 (웹 검색, ~8-12초) ─────────────────────────────
        const marketText = await callClaudeWithSearch(
          `오늘(${today}) 실시간 웹 검색으로 한국·미국 주식시장 현황을 조사하고 3문장으로 요약하세요.
지수(코스피/코스닥/나스닥/S&P500), 주요 이슈, 섹터 동향을 포함하세요.
JSON으로만: {"marketSummary": "요약 3문장"}`,
          400,
          2
        );
        const m = safeParseJSON(marketText);
        marketSummary = (m.marketSummary as string) || marketText.slice(0, 400);
        send({ type: "market", marketSummary });

        // ── 2단계: 종목별 분석 + 뉴스 (웹 검색, ~10-15초) ───────────────────
        const stocksText = await callClaudeWithSearch(
          `오늘(${today}) 웹 검색으로 아래 보유 종목의 최신 뉴스와 시황을 조사해 분석하세요.

보유 종목:
${stockList}

JSON으로만:
{
  "stockBriefings": [
    {
      "stockId": "${idPrefix}0 형식",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 판단 2문장 (최신 뉴스 반영)",
      "newsPreview": ["뉴스제목1", "뉴스제목2"],
      "currentPrice": null,
      "returnRate": null
    }
  ],
  "news": [
    {
      "id": "n1",
      "stockId": "${idPrefix}N 또는 null",
      "stockName": "종목명 또는 null",
      "title": "실제 뉴스 제목",
      "summary": "1문장 요약",
      "url": "실제 URL 또는 빈 문자열",
      "source": "출처",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙: stockBriefings는 종목 없으면 빈 배열, news는 3-5개`,
          1500,
          3
        );
        const s = safeParseJSON(stocksText);
        stockBriefings = ((s.stockBriefings as StockBriefing[]) || []).map(
          (sb: StockBriefing & { stockId: string }) => ({
            ...sb,
            stockId: idMap[sb.stockId] || sb.stockId,
          })
        );
        news = ((s.news as (NewsItem & { stockId: string })[]) || []).map((n) => ({
          ...n,
          stockId: n.stockId ? idMap[n.stockId] || n.stockId : undefined,
        }));
        send({ type: "stocks", stockBriefings, news });

        // ── 3단계: 추천 종목 (학습 데이터, ~3-5초) ───────────────────────────
        const recommendText = await callClaude(
          `오늘(${today}) 주목할 만한 종목 3개를 추천하세요.

JSON으로만:
{
  "recommendedStocks": [
    {
      "name": "종목명",
      "code": "코드/티커",
      "country": "KR 또는 US",
      "type": "growth 또는 value 또는 rebound 또는 dividend",
      "reason": "추천 이유 1문장",
      "bullets": ["근거1", "근거2", "근거3"],
      "targetPrice": "목표가"
    }
  ]
}`,
          700
        );
        const r = safeParseJSON(recommendText);
        recommendedStocks = (r.recommendedStocks as RecommendedStock[]) || [];
        send({ type: "recommend", recommendedStocks });

        // ── 완료 ──────────────────────────────────────────────────────────────
        const briefing: DailyBriefing = {
          date: today,
          generatedAt: now,
          marketSummary,
          stockBriefings,
          recommendedStocks,
          news,
        };
        if (saveToKv) await kvSetBriefing(briefing);
        send({ type: "done", briefing });

      } catch (e: unknown) {
        send({ type: "error", message: e instanceof Error ? e.message : "서버 오류" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
