import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { CaptureAnalysis } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VISION_PROMPT = `당신은 주식 MTS(모바일 트레이딩 시스템) 화면 분석 전문가입니다.
이 이미지는 한국 또는 미국 주식 앱의 스크린샷입니다.

다음 정보를 이미지에서 최대한 추출해주세요:

[한국 MTS 예시: 삼성증권 mPOP, 키움 영웅문S#, 미래에셋 m.ALL, NH투자증권 나무, 토스증권, KB증권, 신한투자증권, 카카오페이증권]
- 현재가: 숫자 + 원 (예: 75,400원)
- 등락률: +/- 퍼센트 (예: +1.23%)
- 등락금액: +/- 원 (예: +900원)
- 평단가(매입가/평균단가): 숫자 + 원
- 수익률(손익률): +/- 퍼센트
- 평가손익: +/- 원
- 평가금액: 숫자 + 원
- 보유수량: 숫자 + 주

[미국 주식 앱 예시: Robinhood, TD Ameritrade, E*TRADE, Fidelity, Charles Schwab, Interactive Brokers, Webull]
- 현재가: $ 숫자 (예: $182.50)
- 등락률: +/- 퍼센트 (예: +0.85%)
- 평균매입가: $ 숫자
- 수익률: +/- 퍼센트
- 총 수익: +/- $ 숫자

[종목 정보]
- 종목명 (한글 또는 영문)
- 티커/종목코드

아래 JSON 형식으로만 응답하세요. 확인할 수 없는 필드는 null로:
{
  "stockName": "종목명 또는 null",
  "currentPrice": "현재가 텍스트 또는 null",
  "changeRate": "등락률 텍스트 (예: +1.23%) 또는 null",
  "avgPrice": "평단가/평균매입가 텍스트 또는 null",
  "returnRate": "수익률 텍스트 (예: +15.3%) 또는 null",
  "evaluationAmount": "평가금액 텍스트 또는 null",
  "quantity": "보유수량 텍스트 또는 null",
  "analysisText": "이 캡처에서 읽은 정보 한줄 요약 (예: '삼성전자 75,400원, 수익률 +15.3%')",
  "appType": "인식된 앱 이름 또는 null"
}`;

export async function POST(req: NextRequest) {
  try {
    const { stockId, slot, imageData, stockName } = await req.json();

    if (!imageData || !imageData.startsWith("data:image")) {
      return NextResponse.json({ error: "유효하지 않은 이미지" }, { status: 400 });
    }

    const base64Data = imageData.split(",")[1];
    const rawMime = imageData.split(";")[0].split(":")[1];
    // Claude Vision은 jpeg/png/gif/webp만 지원
    const supportedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
    type SupportedMime = typeof supportedMimes[number];
    const mimeType: SupportedMime = supportedMimes.includes(rawMime as SupportedMime)
      ? (rawMime as SupportedMime)
      : "image/jpeg";

    const prompt = stockName
      ? `${VISION_PROMPT}\n\n참고: 이 캡처는 "${stockName}" 종목 관련 화면입니다.`
      : VISION_PROMPT;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64Data },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("분석 결과를 파싱할 수 없습니다");
    }

    const raw = JSON.parse(jsonMatch[0]);

    // null 값 제거
    const analysis: CaptureAnalysis = Object.fromEntries(
      Object.entries(raw).filter(([, v]) => v !== null && v !== "")
    ) as CaptureAnalysis;

    return NextResponse.json({ stockId, slot, analysis });
  } catch (e: unknown) {
    console.error("캡처 분석 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
