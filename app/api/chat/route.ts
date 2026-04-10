import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Stock } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      stocks,
    }: { messages: ChatMessage[]; stocks: Stock[] } = await req.json();

    const stockContext =
      stocks.length > 0
        ? stocks
            .map(
              (s) =>
                `- ${s.name}(${s.code}, ${s.country === "KR" ? "한국" : "미국"})${s.targetPrice ? ` 목표가: ${s.targetPrice}${s.currency === "KRW" ? "원" : "$"}` : ""}${s.stopLossPrice ? ` 손절가: ${s.stopLossPrice}${s.currency === "KRW" ? "원" : "$"}` : ""}`
            )
            .join("\n")
        : "등록된 보유종목 없음";

    const systemPrompt = `당신은 전문 주식 투자 상담 AI입니다. 사용자의 보유종목 정보를 바탕으로 맞춤형 투자 분석을 제공합니다.

## 사용자 보유종목
${stockContext}

## 응답 지침
- 보유종목과 연관된 분석은 목표가/손절가 정보를 활용하여 구체적으로 답변
- 한국어로 답변, 친근하면서도 전문적인 톤 유지
- 투자 판단의 최종 책임은 사용자에게 있음을 적절히 안내
- 최신 시장 상황과 데이터를 기반으로 현실적인 분석 제공
- 답변은 간결하고 핵심 위주로 (너무 길지 않게)`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({
      content,
      searched: true, // 실시간 검색 기능 추가 시 실제 플래그로 교체
    });
  } catch (e: unknown) {
    console.error("채팅 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
