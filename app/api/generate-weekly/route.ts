import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Stock, WeeklyIssues, WeeklyIssue } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  try {
    const { stocks }: { stocks: Stock[] } = await req.json();
    const weekStart = getThisMonday();
    const now = new Date().toISOString();

    const stockList =
      stocks.length > 0
        ? stocks.map((s) => `${s.name}(${s.code})`).join(", ")
        : "없음";

    const prompt = `이번 주(${weekStart} 시작) 글로벌 시장의 핵심 경제·시장 이슈 3개를 생성해주세요.
웹 검색으로 이번 주 실제 주요 이슈를 조사하여 반영하세요.

보유 종목: ${stockList}

JSON 형식 (마크다운 없이 순수 JSON):
{
  "issues": [
    {
      "id": "i1",
      "title": "이슈 제목",
      "description": "이슈 설명 (2-3문장, 구체적 수치와 영향 포함)",
      "relatedStocks": [
        { "stockName": "종목명", "tag": "risk 또는 caution 또는 watch" }
      ]
    }
  ]
}

규칙:
- 이번 주 실제 주요 경제 이슈 반영 (미연준, 실적시즌, 지정학적 리스크 등)
- relatedStocks는 보유종목과 연관있는 경우만 포함
- tag: risk(직접 손실 위험), caution(주의), watch(주시)`;

    // 웹 검색 활성화
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.beta as any).messages.create({
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

    const text = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSON 파싱 실패");

    const parsed = JSON.parse(jsonMatch[0]);

    const result: WeeklyIssues = {
      weekStart,
      generatedAt: now,
      issues: (parsed.issues || []) as WeeklyIssue[],
    };

    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error("주간이슈 생성 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
