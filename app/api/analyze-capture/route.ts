import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis, CaptureDeepAnalysis } from "@/lib/types";

export const maxDuration = 60;

/** Claude 응답에서 첫 번째 완전한 JSON 객체 추출 */
function extractFirstJSON(text: string): string | null {
  const clean = text.replace(/```(?:json)?\s*/g, "").replace(/```/g, "");
  const start = clean.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inString = false, escape = false;
  for (let i = start; i < clean.length; i++) {
    const ch = clean[i];
    if (escape)               { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"')           { inString = !inString; continue; }
    if (inString)             { continue; }
    if (ch === "{")           { depth++; }
    if (ch === "}")           { depth--; if (depth === 0) return clean.slice(start, i + 1); }
  }
  return null;
}

/** 파싱 실패 시 텍스트에서 최대한 의견 추출해 폴백 객체 반환 */
function fallbackDeepAnalysis(text: string): CaptureDeepAnalysis {
  const lower = text.toLowerCase();
  let opinion: "buy" | "hold" | "sell" = "hold";
  if (/\bbuy\b|매수/.test(lower))  opinion = "buy";
  else if (/\bsell\b|매도/.test(lower)) opinion = "sell";

  // 텍스트에서 목표가/손절가 패턴 시도
  const targetMatch  = text.match(/목표가[:\s]*([￦$₩]?[\d,]+[원달러]?)/);
  const stopMatch    = text.match(/손절가[:\s]*([￦$₩]?[\d,]+[원달러]?)/);

  return {
    opinion,
    opinionReasons: [text.replace(/\s+/g, " ").trim().slice(0, 400)],
    targetPrice:    targetMatch?.[1] ?? null,
    stopLossPrice:  stopMatch?.[1]  ?? null,
    risks: [],
    chartAnalysis:  "",
    marketContext:  "",
    newsItems:      [],
    summary:        text.replace(/\s+/g, " ").trim().slice(0, 200),
  };
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Step 1: 이미지에서 종목 데이터 추출 (다중 종목) ──────────────────────────
const IMAGE_PROMPT = `당신은 주식 MTS(모바일 트레이딩 시스템) 화면 분석 전문가입니다.
이 이미지는 한국 또는 미국 주식 앱의 스크린샷입니다.

이미지에 보이는 모든 종목을 빠짐없이 추출하세요. 보유종목 목록 화면처럼 여러 종목이 동시에 보일 수 있습니다.

[한국 MTS: 삼성증권 mPOP, 키움 영웅문S#, 미래에셋 m.ALL, NH나무, 토스증권, KB증권, 신한투자증권]
- 현재가(원), 등락률(%), 평단가/평균매입가(원), 수익률(%), 평가금액(원), 보유수량(주)

[미국 주식 앱: Robinhood, Fidelity, Schwab, IBKR, Webull, TD Ameritrade]
- Current Price($), Change(%), Average Cost($), Return(%), Total Value($)

[공통]
- 종목명(한글 또는 영문), 티커/종목코드

아래 형식의 JSON 객체로만 응답하세요 (마크다운 금지, 확인 불가 필드는 null):
{
  "appType": "인식된 앱 이름 또는 null",
  "stocks": [
    {
      "stockName": "종목명",
      "currentPrice": "현재가 텍스트 또는 null",
      "changeRate": "등락률 (예: +1.23%) 또는 null",
      "avgPrice": "평단가 텍스트 또는 null",
      "returnRate": "수익률 (예: +15.3%) 또는 null",
      "evaluationAmount": "평가금액 텍스트 또는 null",
      "quantity": "보유수량 텍스트 또는 null",
      "analysisText": "한줄 요약"
    }
  ]
}`;

// ── Step 2: 심층 분석 프롬프트 ───────────────────────────────────────────────
function buildDeepPrompt(analysis: CaptureAnalysis): string {
  const today = new Date().toISOString().split("T")[0];
  const stockName = analysis.stockName ?? "이 종목";
  const ctx = [
    analysis.stockName      && `종목명: ${analysis.stockName}`,
    analysis.currentPrice   && `현재가: ${analysis.currentPrice}`,
    analysis.changeRate     && `등락률: ${analysis.changeRate}`,
    analysis.returnRate     && `수익률(평단 대비): ${analysis.returnRate}`,
    analysis.avgPrice       && `평단가: ${analysis.avgPrice}`,
    analysis.evaluationAmount && `평가금액: ${analysis.evaluationAmount}`,
    analysis.quantity       && `보유수량: ${analysis.quantity}`,
  ].filter(Boolean).join("\n");

  return `당신은 주식 투자 전문 애널리스트입니다. 오늘은 ${today}입니다.

MTS 화면에서 추출한 데이터:
${ctx}

다음 3가지를 수행하세요:
1. 웹 검색으로 오늘 "${stockName}" 관련 최신 뉴스·공시·실적·이벤트를 찾으세요
2. 현재 시장 상황(한국/미국)과 이 종목의 연관성을 파악하세요
3. 첨부 이미지에 차트가 있다면 최근 흐름을 분석하세요

위 정보를 종합해 투자 의견을 내리고, 마크다운 없이 순수 JSON으로만 응답:
{
  "opinion": "buy 또는 hold 또는 sell",
  "opinionReasons": ["이유1 (수치/근거 포함)", "이유2", "이유3 이상 반드시 작성"],
  "targetPrice": "목표가 (예: 85,000원, $180.0) 또는 null",
  "stopLossPrice": "손절가 또는 null",
  "risks": ["리스크1", "리스크2 이상 반드시 작성"],
  "chartAnalysis": "차트 흐름 2-3문장 (차트 없으면 '캡처에 차트 정보 없음')",
  "marketContext": "시장 전반 연관성 1-2문장",
  "newsItems": [
    { "title": "뉴스 제목", "summary": "한줄 요약", "source": "출처명", "url": "실제 URL" }
  ],
  "summary": "종합 한줄 요약"
}`;
}

/** Step 2 응답 텍스트 → CaptureDeepAnalysis (파싱 실패 시 폴백) */
function parseDeep(text: string): CaptureDeepAnalysis {
  // 1차: 정상 JSON 파싱 시도
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
        chartAnalysis:  r.chartAnalysis  ?? "",
        marketContext:  r.marketContext  ?? "",
        newsItems:      Array.isArray(r.newsItems) ? r.newsItems : [],
        summary:        r.summary ?? "",
      };
    } catch { /* fall through */ }
  }
  // 2차: 텍스트 기반 폴백
  return fallbackDeepAnalysis(text);
}

export async function POST(req: NextRequest) {
  try {
    const { imageData } = await req.json();

    if (!imageData?.startsWith("data:image")) {
      return NextResponse.json({ error: "유효하지 않은 이미지" }, { status: 400 });
    }

    const base64  = imageData.split(",")[1];
    const rawMime = imageData.split(";")[0].split(":")[1];
    const supported = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type Mime = typeof supported[number];
    const mime: Mime = supported.includes(rawMime as Mime) ? (rawMime as Mime) : "image/jpeg";

    // ── Step 1: 이미지에서 모든 종목 추출 ───────────────────────────────────
    const step1 = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          { type: "text", text: IMAGE_PROMPT },
        ],
      }],
    });

    const step1Text = step1.content[0].type === "text" ? step1.content[0].text : "";
    const step1Json = extractFirstJSON(step1Text);
    if (!step1Json) throw new Error("이미지에서 종목 정보를 추출할 수 없습니다");

    const wrapper = JSON.parse(step1Json);
    const rawStocks: CaptureAnalysis[] = Array.isArray(wrapper.stocks) ? wrapper.stocks : [];
    if (rawStocks.length === 0) throw new Error("이미지에서 종목을 찾을 수 없습니다");

    // null/빈값 필드 제거
    const analyses: CaptureAnalysis[] = rawStocks.map((s) =>
      Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== "")) as CaptureAnalysis
    );

    // ── Step 2: 각 종목 심층 분석 (병렬) ────────────────────────────────────
    const deepAnalyses: CaptureDeepAnalysis[] = await Promise.all(
      analyses.map(async (analysis) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const step2 = await (client.beta as any).messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2048,
            betas: ["web-search-2025-03-05"],
            tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }],
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
                { type: "text", text: buildDeepPrompt(analysis) },
              ],
            }],
          });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const text = step2.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
          return parseDeep(text);
        } catch (e) {
          console.error("심층 분석 오류:", e);
          return fallbackDeepAnalysis("심층 분석 중 오류가 발생했습니다. 기본 정보만 표시합니다.");
        }
      })
    );

    return NextResponse.json({ analyses, deepAnalyses });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    console.error("캡처 분석 오류:", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
