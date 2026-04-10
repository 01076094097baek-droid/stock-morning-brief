import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Stock, DailyBriefing, StockBriefing, RecommendedStock, NewsItem, CaptureAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      stocks,
      capturesSummary,
    }: { stocks: Stock[]; capturesSummary?: Record<string, CaptureAnalysis | null> } = await req.json();

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    // 캡처 분석 데이터 포함한 종목 목록
    const stockList = stocks.length > 0
      ? stocks.map((s, i) => {
          const cap = capturesSummary?.[s.id];
          const capInfo = cap
            ? ` [캡처분석: 현재가=${cap.currentPrice ?? "미확인"}, 수익률=${cap.returnRate ?? "미확인"}, 평단가=${cap.avgPrice ?? "미확인"}]`
            : "";
          return `- s${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"}${s.targetPrice ? `, 목표가: ${s.targetPrice}` : ""}${s.stopLossPrice ? `, 손절가: ${s.stopLossPrice}` : ""}${capInfo})`;
        }).join("\n")
      : "등록된 종목 없음";

    const prompt = `오늘은 ${today}입니다. 주식 모닝 브리핑을 JSON 형식으로 생성해주세요.

보유 종목 (캡처 분석 데이터 포함):
${stockList}

캡처 분석 데이터가 있는 종목은 해당 현재가/수익률을 stockBriefings의 currentPrice, returnRate 필드에 반영해주세요.

다음 JSON 구조로 응답하세요. 마크다운 없이 순수 JSON만 출력하세요:
{
  "marketSummary": "한국/미국 시장 전반 요약 (3-4문장, 오늘 날짜 기준 최신 시장 상황)",
  "stockBriefings": [
    {
      "stockId": "s0, s1, s2... 형식",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 AI 판단 요약 (2-3문장, 캡처 데이터 반영)",
      "newsPreview": ["관련 뉴스 제목 1", "관련 뉴스 제목 2"],
      "currentPrice": "현재가 텍스트 또는 null",
      "returnRate": "수익률 텍스트 또는 null"
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
      "targetPrice": "목표가 (예: 85,000원 또는 $185)"
    }
  ],
  "news": [
    {
      "id": "n1",
      "stockId": "관련종목 sN id 또는 null",
      "stockName": "관련종목명 또는 null",
      "title": "뉴스 제목",
      "summary": "뉴스 요약 (1-2문장)",
      "url": "https://example.com/news",
      "source": "출처명",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙:
- stockBriefings는 보유종목이 있을 때만 생성 (없으면 빈 배열)
- recommendedStocks는 항상 3개 생성
- news는 보유종목 관련 + 매크로 합쳐서 5-8개 생성
- 캡처 분석 데이터가 있으면 현재 수익 상황을 판단에 적극 반영
- URL은 실제 뉴스 사이트 형식으로 (완전한 URL)`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]);

    const stockIdMap: Record<string, string> = {};
    stocks.forEach((s, i) => { stockIdMap[`s${i}`] = s.id; });

    const stockBriefings: StockBriefing[] = (parsed.stockBriefings || []).map(
      (sb: StockBriefing & { stockId: string }) => ({
        ...sb,
        stockId: stockIdMap[sb.stockId] || sb.stockId,
      })
    );

    const news: NewsItem[] = (parsed.news || []).map(
      (n: NewsItem & { stockId: string }) => ({
        ...n,
        stockId: n.stockId ? (stockIdMap[n.stockId] || n.stockId) : undefined,
      })
    );

    const briefing: DailyBriefing = {
      date: today,
      generatedAt: now,
      marketSummary: parsed.marketSummary || "",
      stockBriefings,
      recommendedStocks: (parsed.recommendedStocks || []) as RecommendedStock[],
      news,
    };

    return NextResponse.json(briefing);
  } catch (e: unknown) {
    console.error("브리핑 생성 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
