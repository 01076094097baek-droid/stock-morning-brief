import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kvGetStocks, kvSetWeekly, kvSetBriefing } from "@/lib/kv";
import {
  Stock,
  DailyBriefing,
  StockBriefing,
  RecommendedStock,
  NewsItem,
  WeeklyIssues,
  WeeklyIssue,
} from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// UTC 시각을 KST(+9)로 변환
function toKST(date: Date): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

function getThisMonday(kstDate: Date): string {
  const d = new Date(kstDate);
  const day = d.getDay(); // 0=일, 1=월
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}

// 웹 검색으로 브리핑 생성
async function generateBriefingWithSearch(
  stocks: Stock[],
  kstDateStr: string,
  now: string
): Promise<DailyBriefing> {
  const stockList =
    stocks.length > 0
      ? stocks
          .map(
            (s, i) =>
              `- s${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"}${s.targetPrice ? `, 목표가: ${s.targetPrice}` : ""}${s.stopLossPrice ? `, 손절가: ${s.stopLossPrice}` : ""})`
          )
          .join("\n")
      : "등록된 종목 없음";

  const prompt = `오늘은 ${kstDateStr} (KST)입니다.
웹 검색을 활용하여 오늘의 한국/미국 주식 시장 최신 정보를 조사하고, 아래 JSON 형식으로 모닝 브리핑을 생성해주세요.

보유 종목:
${stockList}

각 보유 종목에 대해 오늘의 최신 뉴스와 시장 상황을 검색하여 판단해주세요.
오늘의 추천 종목 3개도 현재 시장 상황 기반으로 선정해주세요.

JSON 형식 (마크다운 없이 순수 JSON만):
{
  "marketSummary": "한국/미국 시장 전반 요약 (3-4문장, 오늘 날짜 기준 실제 시장 상황)",
  "stockBriefings": [
    {
      "stockId": "s0, s1...",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 AI 판단 요약 (2-3문장, 최신 뉴스 반영)",
      "newsPreview": ["관련 뉴스 제목 1", "관련 뉴스 제목 2"],
      "currentPrice": null,
      "returnRate": null
    }
  ],
  "recommendedStocks": [
    {
      "name": "종목명",
      "code": "종목코드 또는 티커",
      "country": "KR 또는 US",
      "type": "growth 또는 value 또는 rebound 또는 dividend",
      "reason": "추천 이유 (1-2문장)",
      "bullets": ["근거1", "근거2", "근거3"],
      "targetPrice": "목표가"
    }
  ],
  "news": [
    {
      "id": "n1",
      "stockId": "sN 또는 null",
      "stockName": "종목명 또는 null",
      "title": "실제 뉴스 제목",
      "summary": "뉴스 요약 (1-2문장)",
      "url": "실제 URL",
      "source": "출처명",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (client.beta as any).messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    betas: ["web-search-2025-03-05"],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 10,
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = resp.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)
    .join("");

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("브리핑 JSON 파싱 실패");

  const parsed = JSON.parse(jsonMatch[0]);

  const stockIdMap: Record<string, string> = {};
  stocks.forEach((s, i) => {
    stockIdMap[`s${i}`] = s.id;
  });

  const stockBriefings: StockBriefing[] = (parsed.stockBriefings || []).map(
    (sb: StockBriefing & { stockId: string }) => ({
      ...sb,
      stockId: stockIdMap[sb.stockId] || sb.stockId,
    })
  );

  const news: NewsItem[] = (parsed.news || []).map(
    (n: NewsItem & { stockId: string }) => ({
      ...n,
      stockId: n.stockId
        ? stockIdMap[n.stockId] || n.stockId
        : undefined,
    })
  );

  return {
    date: kstDateStr,
    generatedAt: now,
    marketSummary: parsed.marketSummary || "",
    stockBriefings,
    recommendedStocks: (parsed.recommendedStocks || []) as RecommendedStock[],
    news,
  };
}

// 웹 검색으로 주간 이슈 생성
async function generateWeeklyWithSearch(
  stocks: Stock[],
  weekStart: string,
  now: string
): Promise<WeeklyIssues> {
  const stockList =
    stocks.length > 0
      ? stocks.map((s) => `${s.name}(${s.code})`).join(", ")
      : "없음";

  const prompt = `이번 주(${weekStart} 시작) 글로벌 시장의 핵심 경제·시장 이슈 3개를 생성해주세요.
웹 검색으로 이번 주 실제 주요 이슈를 조사하세요.

보유 종목: ${stockList}

JSON 형식 (마크다운 없이):
{
  "issues": [
    {
      "id": "i1",
      "title": "이슈 제목",
      "description": "이슈 설명 (2-3문장, 구체적 수치 포함)",
      "relatedStocks": [
        { "stockName": "종목명", "tag": "risk 또는 caution 또는 watch" }
      ]
    }
  ]
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resp = await (client.beta as any).messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    betas: ["web-search-2025-03-05"],
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const responseText = resp.content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((b: any) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b: any) => b.text)
    .join("");

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("주간이슈 JSON 파싱 실패");
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    weekStart,
    generatedAt: now,
    issues: (parsed.issues || []) as WeeklyIssue[],
  };
}

// ── Vercel Cron 엔드포인트 ──
// Schedule: "0 23 * * *" (UTC) = 08:00 KST 매일
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const utcNow = new Date();
  const kstNow = toKST(utcNow);
  const kstDateStr = kstNow.toISOString().split("T")[0];
  const now = utcNow.toISOString();

  // 월요일 KST 여부 (크론이 23:00 UTC에 돌면 KST는 다음날 08:00)
  const isMonday = kstNow.getDay() === 1;

  const results: Record<string, unknown> = {
    date: kstDateStr,
    isMonday,
  };

  try {
    // KV에서 종목 조회
    const stocks = await kvGetStocks();
    results.stockCount = stocks.length;

    // 일일 브리핑 생성 (웹 검색)
    try {
      const briefing = await generateBriefingWithSearch(stocks, kstDateStr, now);
      await kvSetBriefing(briefing);
      results.briefing = "success";
    } catch (e) {
      results.briefing = `failed: ${e instanceof Error ? e.message : String(e)}`;
    }

    // 월요일: 주간 이슈 생성
    if (isMonday) {
      try {
        const weekStart = getThisMonday(kstNow);
        const weekly = await generateWeeklyWithSearch(stocks, weekStart, now);
        await kvSetWeekly(weekly);
        results.weekly = "success";
      } catch (e) {
        results.weekly = `failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    return NextResponse.json({ success: true, ...results });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Cron 실행 실패", ...results },
      { status: 500 }
    );
  }
}
