import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  Stock,
  DailyBriefing,
  StockBriefing,
  RecommendedStock,
  NewsItem,
  CaptureAnalysis,
} from "@/lib/types";
import { kvSetBriefing } from "@/lib/kv";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const {
      stocks,
      capturesSummary,
      useWebSearch = false,
      saveToKv = false,
    }: {
      stocks: Stock[];
      capturesSummary?: Record<string, CaptureAnalysis | null>;
      useWebSearch?: boolean;
      saveToKv?: boolean;
    } = await req.json();

    const today = new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();

    const stockList =
      stocks.length > 0
        ? stocks
            .map((s, i) => {
              const cap = capturesSummary?.[s.id];
              const capInfo = cap
                ? ` [캡처: 현재가=${cap.currentPrice ?? "-"}, 수익률=${cap.returnRate ?? "-"}, 평단가=${cap.avgPrice ?? "-"}]`
                : "";
              return `- s${i}: ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"}${s.targetPrice ? `, 목표가: ${s.targetPrice}` : ""}${s.stopLossPrice ? `, 손절가: ${s.stopLossPrice}` : ""}${capInfo})`;
            })
            .join("\n")
        : "등록된 종목 없음";

    const prompt = `오늘은 ${today}입니다. 주식 모닝 브리핑을 JSON 형식으로 생성해주세요.
${useWebSearch ? "웹 검색을 활용하여 오늘 날짜 기준 최신 시장 정보와 뉴스를 수집하세요." : ""}

보유 종목:
${stockList}

${capturesSummary ? "캡처 분석 데이터가 있는 종목은 현재가/수익률을 stockBriefings에 반영해주세요." : ""}

다음 JSON 구조로만 응답하세요 (마크다운 없이 순수 JSON):
{
  "marketSummary": "한국/미국 시장 전반 요약 (3-4문장, 오늘 날짜 기준 최신 상황)",
  "stockBriefings": [
    {
      "stockId": "s0, s1, s2... 형식",
      "stockName": "종목명",
      "country": "KR 또는 US",
      "judgment": "hold 또는 monitor 또는 sell",
      "summary": "오늘의 AI 판단 요약 (2-3문장)",
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
      "targetPrice": "목표가"
    }
  ],
  "news": [
    {
      "id": "n1",
      "stockId": "sN 또는 null",
      "stockName": "종목명 또는 null",
      "title": "뉴스 제목",
      "summary": "뉴스 요약 (1-2문장)",
      "url": "실제 URL",
      "source": "출처명",
      "publishedAt": "${now}",
      "category": "KR 또는 US 또는 MACRO"
    }
  ]
}

규칙:
- stockBriefings는 보유종목 있을 때만 생성 (없으면 빈 배열)
- recommendedStocks는 항상 3개
- news는 5-8개 (보유종목 관련 + 매크로)
- 캡처 데이터 있는 종목은 실제 수익률 기반으로 판단`;

    let responseText = "";

    if (useWebSearch) {
      // 웹 검색 활성화 — beta API 사용
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resp = await (client.beta as any).messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        betas: ["web-search-2025-03-05"],
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 8,
          },
        ],
        messages: [{ role: "user", content: prompt }],
      });

      // 최종 텍스트 블록만 추출
      responseText = resp.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("");
    } else {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      responseText =
        resp.content[0].type === "text" ? resp.content[0].text : "";
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

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

    const briefing: DailyBriefing = {
      date: today,
      generatedAt: now,
      marketSummary: parsed.marketSummary || "",
      stockBriefings,
      recommendedStocks: (parsed.recommendedStocks || []) as RecommendedStock[],
      news,
    };

    // Cron 실행 시 KV에도 저장
    if (saveToKv) {
      await kvSetBriefing(briefing);
    }

    return NextResponse.json(briefing);
  } catch (e: unknown) {
    console.error("브리핑 생성 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
