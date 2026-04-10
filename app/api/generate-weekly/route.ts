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

    const stockList = stocks.length > 0
      ? stocks.map((s) => `${s.name}(${s.code})`).join(", ")
      : "없음";

    const prompt = `이번 주(${weekStart} 시작) 글로벌 시장의 핵심 경제·시장 이슈 3개를 JSON으로 생성해주세요.

보유 종목: ${stockList}

JSON 형식 (마크다운 없이 순수 JSON):
{
  "issues": [
    {
      "id": "i1",
      "title": "이슈 제목 (간결하게)",
      "description": "이슈 설명 (2-3문장, 구체적 수치와 영향 포함)",
      "relatedStocks": [
        {
          "stockName": "종목명",
          "tag": "risk 또는 caution 또는 watch"
        }
      ]
    }
  ]
}

규칙:
- 이번 주 실제 주요 경제 이슈 반영 (미연준 동향, 실적시즌, 지정학적 리스크 등)
- relatedStocks는 보유종목과 연관있는 경우만 포함
- 각 이슈는 투자자에게 실질적으로 중요한 내용
- tag: risk(직접적 손실 위험), caution(주의 요망), watch(주시 필요)`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
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
