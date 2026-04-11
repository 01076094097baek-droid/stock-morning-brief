import { NextRequest, NextResponse } from "next/server";
import { kvSetStocks } from "@/lib/kv";
import { Stock } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { stocks }: { stocks: Stock[] } = await req.json();
    await kvSetStocks(stocks);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
