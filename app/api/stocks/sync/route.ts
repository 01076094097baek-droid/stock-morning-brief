import { NextRequest, NextResponse } from "next/server";
import { kvSetStocks } from "@/lib/kv";
import { Stock } from "@/lib/types";

// 클라이언트 → KV 종목 동기화
export async function POST(req: NextRequest) {
  try {
    const { stocks }: { stocks: Stock[] } = await req.json();
    await kvSetStocks(stocks);
    return NextResponse.json({ ok: true, count: stocks.length });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
