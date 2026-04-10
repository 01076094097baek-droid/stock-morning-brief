import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { stockId, slot, imageData } = await req.json();

    if (!imageData || !imageData.startsWith("data:image")) {
      return NextResponse.json({ error: "유효하지 않은 이미지" }, { status: 400 });
    }

    // base64 데이터 추출
    const base64Data = imageData.split(",")[1];
    const mimeType = imageData.split(";")[0].split(":")[1] as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Data,
              },
            },
            {
              type: "text",
              text: `이 주식 시세 캡처 이미지를 분석해주세요. JSON으로만 응답:
{
  "currentPrice": "현재가 (텍스트로)",
  "changeRate": "등락률 (텍스트로)",
  "analysis": "간단한 분석 (1문장)"
}`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    return NextResponse.json({
      stockId,
      slot,
      ...parsed,
    });
  } catch (e: unknown) {
    console.error("캡처 분석 오류:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
