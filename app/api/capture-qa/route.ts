import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis, CaptureDeepAnalysis } from "@/lib/types";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface QAMessage { role: "user" | "assistant"; content: string; }

function buildSystemPrompt(
  analysis: CaptureAnalysis | undefined,
  deepAnalysis: CaptureDeepAnalysis | undefined,
): string {
  const lines = [
    "당신은 주식 투자 전문 어시스턴트입니다.",
    "사용자가 보유 중인 종목에 대해 질문하면 웹 검색으로 최신 정보를 수집해 답변하세요.",
    "답변은 간결하고 명확하게, 한국어로 작성하세요.",
    "",
  ];

  if (analysis?.stockName) {
    lines.push(`## 현재 분석 종목: ${analysis.stockName}`);
    if (analysis.currentPrice)   lines.push(`- 현재가: ${analysis.currentPrice}`);
    if (analysis.changeRate)     lines.push(`- 등락률: ${analysis.changeRate}`);
    if (analysis.returnRate)     lines.push(`- 수익률(평단 대비): ${analysis.returnRate}`);
    if (analysis.avgPrice)       lines.push(`- 평단가: ${analysis.avgPrice}`);
    if (analysis.evaluationAmount) lines.push(`- 평가금액: ${analysis.evaluationAmount}`);
    if (analysis.quantity)       lines.push(`- 보유수량: ${analysis.quantity}`);
    lines.push("");
  }

  if (deepAnalysis) {
    const opLabel = deepAnalysis.opinion === "buy" ? "매수" : deepAnalysis.opinion === "sell" ? "매도" : "홀딩";
    lines.push(`## 기존 AI 분석 결과`);
    lines.push(`- 투자의견: ${opLabel}`);
    if (deepAnalysis.opinionReasons.length > 0)
      lines.push(`- 근거: ${deepAnalysis.opinionReasons.join(" / ")}`);
    if (deepAnalysis.targetPrice)   lines.push(`- 목표가: ${deepAnalysis.targetPrice}`);
    if (deepAnalysis.stopLossPrice) lines.push(`- 손절가: ${deepAnalysis.stopLossPrice}`);
    if (deepAnalysis.risks.length > 0)
      lines.push(`- 리스크: ${deepAnalysis.risks.join(", ")}`);
    if (deepAnalysis.summary) lines.push(`- 요약: ${deepAnalysis.summary}`);
    lines.push("");
  }

  lines.push("최신 정보가 필요한 경우 웹 검색을 사용해 오늘 날짜 기준으로 답변하세요.");
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const {
      analysis,
      deepAnalysis,
      messages,
    }: {
      analysis?: CaptureAnalysis;
      deepAnalysis?: CaptureDeepAnalysis;
      messages: QAMessage[];
    } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "메시지가 없습니다" }, { status: 400 });
    }

    const system = buildSystemPrompt(analysis, deepAnalysis);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await (client.beta as any).messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      betas: ["web-search-2025-03-05"],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answer = resp.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();

    return NextResponse.json({ answer });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    console.error("Q&A 오류:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
