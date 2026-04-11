import { NextResponse } from "next/server";
import { kvGetBriefing } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET() {
  const briefing = await kvGetBriefing();
  return NextResponse.json({ briefing });
}
