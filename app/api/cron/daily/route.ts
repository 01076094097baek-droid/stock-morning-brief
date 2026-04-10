import { NextRequest, NextResponse } from "next/server";

// Vercel Cron: 매일 08:00 KST (= 23:00 UTC 전날)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://stock-morning-brief.vercel.app";
    const today = new Date();
    const isMonday = today.getDay() === 1;

    // 브리핑 생성 (종목 없이 시장 요약만)
    const briefingRes = await fetch(`${baseUrl}/api/generate-briefing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks: [] }),
    });

    const results: Record<string, unknown> = {
      briefing: briefingRes.ok ? "success" : "failed",
    };

    // 월요일이면 주간이슈도 생성
    if (isMonday) {
      const weeklyRes = await fetch(`${baseUrl}/api/generate-weekly`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stocks: [] }),
      });
      results.weekly = weeklyRes.ok ? "success" : "failed";
    }

    return NextResponse.json({
      success: true,
      date: today.toISOString(),
      ...results,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Cron 실행 실패" },
      { status: 500 }
    );
  }
}
