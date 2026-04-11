import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `당신은 주식 MTS(모바일 트레이딩 시스템) 화면 분석 전문가입니다.
이 이미지는 한국 또는 미국 주식 앱의 스크린샷입니다.

아래 정보를 이미지에서 최대한 추출하세요:

[한국 MTS: 삼성증권 mPOP, 키움 영웅문S#, 미래에셋 m.ALL, NH나무, 토스증권, KB증권, 신한투자증권]
- 현재가(원), 등락률(%), 평단가/평균매입가(원), 수익률(%), 평가금액(원), 보유수량(주)

[미국 주식 앱: Robinhood, Fidelity, Schwab, IBKR, Webull, TD Ameritrade]
- Current Price($), Change(%), Average Cost($), Return(%), Total Value($)

[공통]
- 종목명(한글 또는 영문), 티커/종목코드

JSON으로만 응답 (확인 불가 필드는 null):
{
  "stockName": "종목명 또는 null",
  "currentPrice": "현재가 텍스트 또는 null",
  "changeRate": "등락률 (예: +1.23%) 또는 null",
  "avgPrice": "평단가/평균매입가 텍스트 또는 null",
  "returnRate": "수익률 (예: +15.3%) 또는 null",
  "evaluationAmount": "평가금액 텍스트 또는 null",
  "quantity": "보유수량 텍스트 또는 null",
  "analysisText": "한줄 요약 (예: 삼성전자 75,400원, 수익률 +15.3%)",
  "appType": "인식된 앱 이름 또는 null"
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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: base64 } },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("분석 결과를 파싱할 수 없습니다");

    const raw = JSON.parse(match[0]);
    // Strip null values
    const analysis: CaptureAnalysis = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== "")
    ) as CaptureAnalysis;

    return NextResponse.json(analysis);
  } catch (e: unknown) {
    console.error("캡처 분석 오류:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류" }, { status: 500 });
  }
}
