import { NextResponse } from "next/server";
import { kvGetBriefing } from "@/lib/kv";

// 최신 브리핑 조회 (KV → 클라이언트)
export async function GET() {
  try {
    const briefing = await kvGetBriefing();
    if (!briefing) {
      return NextResponse.json({ briefing: null });
    }
    return NextResponse.json({ briefing });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
