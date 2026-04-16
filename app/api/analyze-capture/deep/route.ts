import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis, CaptureDeepAnalysis } from "@/lib/types";

export const runtime = "edge";

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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildPrompt(a: CaptureAnalysis): string {
  const today = new Date().toISOString().split("T")[0];
  const ctx = [
    a.stockName        && `종목: ${a.stockName}`,
    a.currentPrice     && `현재가: ${a.currentPrice}`,
    a.changeRate       && `등락률: ${a.changeRate}`,
    a.returnRate       && `수익률: ${a.returnRate}`,
    a.avgPrice         && `평단가: ${a.avgPrice}`,
    a.evaluationAmount && `평가금액: ${a.evaluationAmount}`,
    a.quantity         && `수량: ${a.quantity}`,
  ].filter(Boolean).join(", ");

  return `오늘(${today}) ${a.stockName ?? "이 종목"} 투자 분석을 JSON으로만 작성하세요.

데이터: ${ctx}

JSON 응답 (마크다운 없이):
{
  "opinion": "buy 또는 hold 또는 sell",
  "opinionReasons": ["근거1(수치포함)", "근거2", "근거3"],
  "targetPrice": "목표가 또는 null",
  "stopLossPrice": "손절가 또는 null",
  "risks": ["리스크1", "리스크2"],
  "chartAnalysis": "차트 흐름 1-2문장",
  "marketContext": "시장 연관성 1문장",
  "newsItems": [],
  "summary": "종합 한줄 요약"
}`;
}

function parseDeep(text: string): CaptureDeepAnalysis {
  const jsonStr = extractFirstJSON(text);
  if (jsonStr) {
    try {
      const r = JSON.parse(jsonStr);
      return {
        opinion:        (r.opinion === "buy" || r.opinion === "sell") ? r.opinion : "hold",
        opinionReasons: Array.isArray(r.opinionReasons) ? r.opinionReasons : [],
        targetPrice:    r.targetPrice   ?? null,
        stopLossPrice:  r.stopLossPrice ?? null,
        risks:          Array.isArray(r.risks) ? r.risks : [],
        chartAnalysis:  r.chartAnalysis ?? "",
        marketContext:  r.marketContext ?? "",
        newsItems:      Array.isArray(r.newsItems) ? r.newsItems : [],
        summary:        r.summary ?? "",
      };
    } catch { /* fall through */ }
  }
  const lower = text.toLowerCase();
  const opinion: "buy" | "hold" | "sell" =
    /\bbuy\b|매수/.test(lower) ? "buy" : /\bsell\b|매도/.test(lower) ? "sell" : "hold";
  return {
    opinion,
    opinionReasons: [text.slice(0, 200)],
    targetPrice: null, stopLossPrice: null,
    risks: [], chartAnalysis: "", marketContext: "", newsItems: [],
    summary: text.slice(0, 100),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { analysis }: { analysis: CaptureAnalysis } = await req.json();
    if (!analysis?.stockName) {
      return NextResponse.json({ error: "종목 정보 없음" }, { status: 400 });
    }

    // Sonnet: 심층 분석 (웹 검색 없이, 약 4-7초)
    const resp = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [{ role: "user", content: buildPrompt(analysis) }],
    });

    const text = resp.content[0].type === "text" ? resp.content[0].text : "";
    return NextResponse.json(parseDeep(text));
  } catch (e: unknown) {
    console.error("심층분석(Step2) 오류:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류" }, { status: 500 });
  }
}
