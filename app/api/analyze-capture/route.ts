import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis } from "@/lib/types";

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

// 간결한 프롬프트 – 종목 데이터 추출만 (심층분석은 별도 API)
const IMAGE_PROMPT = `주식 앱 스크린샷에서 모든 종목 데이터를 추출하세요.

JSON으로만 응답 (마크다운 없이):
{
  "stocks": [
    {
      "stockName": "종목명",
      "currentPrice": "현재가 또는 null",
      "changeRate": "등락률(예:+1.23%) 또는 null",
      "avgPrice": "평단가 또는 null",
      "returnRate": "수익률(예:+15.3%) 또는 null",
      "evaluationAmount": "평가금액 또는 null",
      "quantity": "보유수량 또는 null",
      "analysisText": "한줄요약"
    }
  ]
}`;

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

    // Haiku: 이미지에서 종목 데이터 추출 (빠름, 약 3-5초)
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          { type: "text", text: IMAGE_PROMPT },
        ],
      }],
    });

    const text    = resp.content[0].type === "text" ? resp.content[0].text : "";
    const jsonStr = extractFirstJSON(text);
    if (!jsonStr) throw new Error("이미지에서 종목 정보를 추출할 수 없습니다");

    const wrapper   = JSON.parse(jsonStr);
    const rawStocks = Array.isArray(wrapper.stocks) ? wrapper.stocks : [] as CaptureAnalysis[];
    if (rawStocks.length === 0) throw new Error("이미지에서 종목을 찾을 수 없습니다");

    const analyses: CaptureAnalysis[] = rawStocks.map((s: CaptureAnalysis) =>
      Object.fromEntries(Object.entries(s).filter(([, v]) => v !== null && v !== "")) as CaptureAnalysis
    );

    return NextResponse.json({ analyses });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "서버 오류";
    console.error("캡처 분석(Step1) 오류:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
