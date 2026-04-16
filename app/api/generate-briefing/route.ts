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
        // ── 1단계: 시장 요약 (빠름, ~3-5초) ──────────────────────────────────
        const marketText = await callClaude(
          `오늘(${today}) 한국·미국 주식시장 전반을 3문장으로 요약하세요.
JSON으로만: {"marketSummary": "요약 3문장"}`,
          300
        );
        const m = safeParseJSON(marketText);
        marketSummary = (m.marketSummary as string) || marketText.slice(0, 300);
        send({ type: "market", marketSummary });

        // ── 2단계: 종목별 분석 + 뉴스 (~5-8초) ───────────────────────────────
        const stocksText = await callClaude(
          `오늘(${today}) 보유 종목 분석과 관련 뉴스를 작성하세요.

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
      "summary": "오늘의 판단 2문장",
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
      "title": "뉴스 제목",
      "summary": "1문장 요약",
      "url": "",
      "source": "출처",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙: stockBriefings는 종목 없으면 빈 배열, news는 3-5개`,
          1200
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

        // ── 3단계: 추천 종목 (~3-5초) ────────────────────────────────────────
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
