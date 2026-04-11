import { NextRequest, NextResponse } from "next/server";
import { kvGetStocks, kvSetBriefing } from "@/lib/kv";
import { sendBriefingPush } from "@/lib/push";
import Anthropic from "@anthropic-ai/sdk";
import { Stock, DailyBriefing, StockBriefing, RecommendedStock, NewsItem, WeeklyIssue } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toKST(d: Date): Date {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

function getThisMonday(kst: Date): string {
  const d = new Date(kst);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}

async function buildBriefing(
  stocks: Stock[],
  dateStr: string,
  now: string,
  isMonday: boolean
): Promise<DailyBriefing> {
  const stockList =
    stocks.length > 0
      ? stocks.map((s, i) =>
          `- s${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"}` +
          `${s.targetPrice ? `, 목표가: ${s.targetPrice}` : ""}` +
          `${s.stopLossPrice ? `, 손절가: ${s.stopLossPrice}` : ""})`
        ).join("\n")
      : "등록된 종목 없음";

  const weeklySection = isMonday ? `
"weeklyIssues": [
  {
    "id": "w1",
    "title": "이번 주 이슈 제목",
    "description": "설명 (2-3문장, 수치 포함)",
    "relatedStocks": [{ "stockName": "종목명", "tag": "risk 또는 caution 또는 watch" }]
  }
],` : "";

  const prompt = `오늘은 ${dateStr} (KST)입니다.
웹 검색을 활용해 오늘의 한국/미국 주식 시장 최신 정보를 조사하고 브리핑을 생성하세요.

보유 종목:
${stockList}

마크다운 없이 순수 JSON:
{${weeklySection}
  "marketSummary": "시장 전반 요약 (3-4문장, 오늘 실제 상황)",
  "stockBriefings": [
    {
      "stockId": "s0, s1... 형식",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 판단 (2-3문장, 최신 뉴스 반영)",
      "newsPreview": ["뉴스1", "뉴스2"],
      "currentPrice": null,
      "returnRate": null
    }
  ],
  "recommendedStocks": [
    {
      "name": "종목명", "code": "코드", "country": "KR 또는 US",
      "type": "growth 또는 value 또는 rebound 또는 dividend",
      "reason": "추천 이유", "bullets": ["근거1","근거2","근거3"], "targetPrice": "목표가"
    }
  ],
  "news": [
    {
      "id": "n1", "stockId": "sN 또는 null", "stockName": "종목명 또는 null",
      "title": "실제 뉴스 제목", "summary": "요약", "url": "실제 URL",
      "source": "출처", "publishedAt": "${now}", "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙:
- stockBriefings: 종목 없으면 빈 배열
- recommendedStocks: 항상 3개
- news: 5-8개
${isMonday ? "- weeklyIssues: 이번 주 핵심 이슈 3개 (미연준, 실적시즌, 지정학 등)" : ""}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (client.beta as any).messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    betas: ["web-search-2025-03-05"],
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 10 }],
    messages: [{ role: "user", content: prompt }],
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("브리핑 JSON 파싱 실패");
  const parsed = JSON.parse(match[0]);

  const idMap: Record<string, string> = {};
  stocks.forEach((s, i) => { idMap[`s${i}`] = s.id; });

  const stockBriefings: StockBriefing[] = (parsed.stockBriefings || []).map(
    (sb: StockBriefing & { stockId: string }) => ({ ...sb, stockId: idMap[sb.stockId] || sb.stockId })
  );
  const news: NewsItem[] = (parsed.news || []).map(
    (n: NewsItem & { stockId: string }) => ({ ...n, stockId: n.stockId ? idMap[n.stockId] || n.stockId : undefined })
  );

  return {
    date: dateStr,
    generatedAt: now,
    marketSummary: parsed.marketSummary || "",
    stockBriefings,
    recommendedStocks: (parsed.recommendedStocks || []) as RecommendedStock[],
    news,
    weeklyIssues: isMonday ? ((parsed.weeklyIssues || []) as WeeklyIssue[]) : undefined,
  };
}

// Vercel Cron: "0 23 * * *" UTC = 08:00 KST
export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const utcNow  = new Date();
  const kstNow  = toKST(utcNow);
  const dateStr = kstNow.toISOString().split("T")[0];
  const now     = utcNow.toISOString();
  const isMonday = kstNow.getDay() === 1;

  const log: Record<string, unknown> = { date: dateStr, isMonday };

  try {
    const stocks = await kvGetStocks();
    log.stockCount = stocks.length;

    const briefing = await buildBriefing(stocks, dateStr, now, isMonday);
    await kvSetBriefing(briefing);
    log.briefing = "success";

    if (isMonday) log.weekStart = getThisMonday(kstNow);

    // Send push notifications
    try {
      await sendBriefingPush(
        "📊 오늘의 브리핑",
        `${dateStr} 모닝 브리핑이 준비됐어요`
      );
      log.push = "sent";
    } catch (e) {
      log.push = `failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    return NextResponse.json({ success: true, ...log });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Cron 실패", ...log },
      { status: 500 }
    );
  }
}
