/**
 * Vercel KV wrapper — gracefully falls back when KV is not configured.
 * KV_REST_API_URL + KV_REST_API_TOKEN must be set in Vercel env vars.
 */

import { kv as vercelKv } from "@vercel/kv";
import { DailyBriefing, WeeklyIssues, Stock } from "./types";

// KV가 설정되어 있는지 확인
function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const KEYS = {
  STOCKS: "smb:stocks",
  BRIEFING_LATEST: "smb:briefing:latest",
  WEEKLY_LATEST: "smb:weekly:latest",
} as const;

// 종목 동기화
export async function kvSetStocks(stocks: Stock[]): Promise<void> {
  if (!isKvConfigured()) return;
  await vercelKv.set(KEYS.STOCKS, JSON.stringify(stocks));
}

export async function kvGetStocks(): Promise<Stock[]> {
  if (!isKvConfigured()) return [];
  try {
    const data = await vercelKv.get<string>(KEYS.STOCKS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// 일일 브리핑
export async function kvSetBriefing(briefing: DailyBriefing): Promise<void> {
  if (!isKvConfigured()) return;
  // 7일 TTL
  await vercelKv.set(KEYS.BRIEFING_LATEST, JSON.stringify(briefing), { ex: 60 * 60 * 24 * 7 });
}

export async function kvGetBriefing(): Promise<DailyBriefing | null> {
  if (!isKvConfigured()) return null;
  try {
    const data = await vercelKv.get<string>(KEYS.BRIEFING_LATEST);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// 주간 이슈
export async function kvSetWeekly(issues: WeeklyIssues): Promise<void> {
  if (!isKvConfigured()) return;
  // 14일 TTL
  await vercelKv.set(KEYS.WEEKLY_LATEST, JSON.stringify(issues), { ex: 60 * 60 * 24 * 14 });
}

export async function kvGetWeekly(): Promise<WeeklyIssues | null> {
  if (!isKvConfigured()) return null;
  try {
    const data = await vercelKv.get<string>(KEYS.WEEKLY_LATEST);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
