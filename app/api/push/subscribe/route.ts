import { NextRequest, NextResponse } from "next/server";
import { kvSavePushSub, PushSub } from "@/lib/kv";

export async function POST(req: NextRequest) {
  try {
    const sub: PushSub = await req.json();
    if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return NextResponse.json({ error: "유효하지 않은 구독" }, { status: 400 });
    }
    await kvSavePushSub(sub);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "오류" }, { status: 500 });
  }
}
