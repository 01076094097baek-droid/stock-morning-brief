/**
 * Vercel KV (Upstash Redis) wrapper.
 * Gracefully falls back when KV env vars are not configured.
 */
import { kv } from "@vercel/kv";
import { DailyBriefing, Stock } from "./types";

export interface PushSub {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

function isKvConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const KEYS = {
  STOCKS:            "smb:stocks",
  BRIEFING:          "smb:briefing:latest",
  PUSH_SUBSCRIPTIONS:"smb:push:subs",
} as const;

// ── Stocks ────────────────────────────────────────────────────────────────────
export async function kvGetStocks(): Promise<Stock[]> {
  if (!isKvConfigured()) return [];
  try { return (await kv.get<Stock[]>(KEYS.STOCKS)) ?? []; } catch { return []; }
}

export async function kvSetStocks(stocks: Stock[]): Promise<void> {
  if (!isKvConfigured()) return;
  try { await kv.set(KEYS.STOCKS, stocks); } catch {}
}

// ── Briefing ──────────────────────────────────────────────────────────────────
export async function kvGetBriefing(): Promise<DailyBriefing | null> {
  if (!isKvConfigured()) return null;
  try { return await kv.get<DailyBriefing>(KEYS.BRIEFING); } catch { return null; }
}

export async function kvSetBriefing(b: DailyBriefing): Promise<void> {
  if (!isKvConfigured()) return;
  try { await kv.set(KEYS.BRIEFING, b); } catch {}
}

// ── Push Subscriptions ────────────────────────────────────────────────────────
export async function kvGetPushSubs(): Promise<PushSub[]> {
  if (!isKvConfigured()) return [];
  try { return (await kv.get<PushSub[]>(KEYS.PUSH_SUBSCRIPTIONS)) ?? []; } catch { return []; }
}

export async function kvSavePushSub(sub: PushSub): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    const list = await kvGetPushSubs();
    const deduped = list.filter((s) => s.endpoint !== sub.endpoint);
    await kv.set(KEYS.PUSH_SUBSCRIPTIONS, [...deduped, sub]);
  } catch {}
}

export async function kvRemovePushSub(endpoint: string): Promise<void> {
  if (!isKvConfigured()) return;
  try {
    const list = await kvGetPushSubs();
    await kv.set(KEYS.PUSH_SUBSCRIPTIONS, list.filter((s) => s.endpoint !== endpoint));
  } catch {}
}
