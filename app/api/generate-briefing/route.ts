import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Stock, DailyBriefing, StockBriefing, RecommendedStock, NewsItem, WeeklyIssue, CaptureAnalysis } from "@/lib/types";
import { kvSetBriefing } from "@/lib/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      stocks = [],
      capturedStocks,
      useWebSearch = false,
      saveToKv = false,
      includeWeekly = false,
    }: {
      stocks?: Stock[];
      capturedStocks?: CaptureAnalysis[];
      useWebSearch?: boolean;
      saveToKv?: boolean;
      includeWeekly?: boolean;
    } = await req.json();

    const today = new Date().toISOString().split("T")[0];
    const now   = new Date().toISOString();

    // Build stock list — prefer capturedStocks if provided
    const useCaptured = capturedStocks && capturedStocks.length > 0;

    const stockList = useCaptured
      ? capturedStocks!.map((c, i) => {
          const parts = [`- c${i}: ${c.stockName ?? `종목${i}`}`];
          if (c.currentPrice) parts.push(`현재가: ${c.currentPrice}`);
          if (c.returnRate)   parts.push(`수익률: ${c.returnRate}`);
          if (c.avgPrice)     parts.push(`평단가: ${c.avgPrice}`);
          if (c.evaluationAmount) parts.push(`평가금액: ${c.evaluationAmount}`);
          if (c.quantity)     parts.push(`수량: ${c.quantity}`);
          return parts[0] + (parts.length > 1 ? ` [${parts.slice(1).join(", ")}]` : "");
        }).join("\n")
      : stocks.length > 0
      ? stocks.map((s, i) =>
          `- s${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"}` +
          `${s.targetPrice ? `, 목표가: ${s.targetPrice}` : ""}` +
          `${s.stopLossPrice ? `, 손절가: ${s.stopLossPrice}` : ""})`
        ).join("\n")
      : "등록된 종목 없음";

    const idPrefix = useCaptured ? "c" : "s";

    const weeklySection = includeWeekly ? `
"weeklyIssues": [
  {
    "id": "w1",
    "title": "이번 주 이슈 제목",
    "description": "설명 (2-3문장, 수치 포함)",
    "relatedStocks": [{ "stockName": "종목명", "tag": "risk 또는 caution 또는 watch" }]
  }
],` : "";

    const prompt = `오늘은 ${today}입니다. 주식 모닝 브리핑을 JSON으로 생성해주세요.
${useWebSearch ? "웹 검색으로 오늘 날짜 기준 최신 시장 정보와 뉴스를 수집하세요." : ""}
${useCaptured ? "아래는 MTS 캡처 이미지에서 추출한 실제 종목 데이터입니다." : ""}

보유 종목:
${stockList}

마크다운 없이 순수 JSON으로만 응답:
{${weeklySection}
  "marketSummary": "시장 전반 요약 (3-4문장, 한국/미국 모두, 오늘 실제 상황)",
  "stockBriefings": [
    {
      "stockId": "${idPrefix}0, ${idPrefix}1... 형식",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 판단 (2-3문장, 최신 뉴스 반영)",
      "newsPreview": ["뉴스 제목1", "뉴스 제목2"],
      "currentPrice": "현재가 또는 null",
      "returnRate": "수익률 또는 null"
    }
  ],
  "recommendedStocks": [
    {
      "name": "종목명",
      "code": "코드/티커",
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
      "stockId": "${idPrefix}N 또는 null",
      "stockName": "종목명 또는 null",
      "title": "뉴스 제목",
      "summary": "요약 (1-2문장)",
      "url": "실제 URL",
      "source": "출처",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙:
- stockBriefings: 종목 없으면 빈 배열
- recommendedStocks: 항상 3개
- news: 5-8개 (종목 관련 + 매크로)
${includeWeekly ? "- weeklyIssues: 이번 주 핵심 경제·시장 이슈 3개 (미연준, 실적시즌, 지정학 등)" : ""}
${useCaptured ? "- 캡처 데이터 있는 종목은 실제 수익률 기반으로 판단" : ""}`;

    let responseText = "";

    if (useWebSearch) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await (client.beta as any).messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        betas: ["web-search-2025-03-05"],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        messages: [{ role: "user", content: prompt }],
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      responseText = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    } else {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      responseText = resp.content[0].type === "text" ? resp.content[0].text : "";
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");
    const parsed = JSON.parse(jsonMatch[0]);

    // Map short IDs (c0/s0) back to real IDs
    const idMap: Record<string, string> = {};
    if (useCaptured) {
      capturedStocks!.forEach((c, i) => { idMap[`c${i}`] = c.stockName ?? `종목${i}`; });
    } else {
      stocks.forEach((s, i) => { idMap[`s${i}`] = s.id; });
    }

    const stockBriefings: StockBriefing[] = (parsed.stockBriefings || []).map(
      (sb: StockBriefing & { stockId: string }) => ({ ...sb, stockId: idMap[sb.stockId] || sb.stockId })
    );
    const news: NewsItem[] = (parsed.news || []).map(
      (n: NewsItem & { stockId: string }) => ({ ...n, stockId: n.stockId ? idMap[n.stockId] || n.stockId : undefined })
    );

    const briefing: DailyBriefing = {
      date: today,
      generatedAt: now,
      marketSummary: parsed.marketSummary || "",
      stockBriefings,
      recommendedStocks: (parsed.recommendedStocks || []) as RecommendedStock[],
      news,
      weeklyIssues: includeWeekly ? ((parsed.weeklyIssues || []) as WeeklyIssue[]) : undefined,
    };

    if (saveToKv) await kvSetBriefing(briefing);

    return NextResponse.json(briefing);
  } catch (e: unknown) {
    console.error("브리핑 생성 오류:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류" }, { status: 500 });
  }
}
