import { NextResponse } from "next/server";
import { kvGetWeekly } from "@/lib/kv";

export async function GET() {
  try {
    const weekly = await kvGetWeekly();
    return NextResponse.json({ weekly: weekly ?? null });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 }
    );
  }
}
