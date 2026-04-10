import {
  Stock,
  DailyBriefing,
  WeeklyIssues,
  StockCaptures,
  STORAGE_KEYS,
} from "./types";

// 인증
const AUTH_KEY = "smb_pin_hash";
const SESSION_KEY = "smb_session";
const HINT_KEY = "smb_hint";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text + "smb_salt");
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPinSet(): boolean {
  if (!isBrowser()) return false;
  return !!localStorage.getItem(AUTH_KEY);
}

export async function setPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  localStorage.setItem(AUTH_KEY, hash);
  sessionStorage.setItem(SESSION_KEY, "1");
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(AUTH_KEY);
  if (!stored) return false;
  const hash = await sha256(pin);
  const ok = hash === stored;
  if (ok) sessionStorage.setItem(SESSION_KEY, "1");
  return ok;
}

export function isSessionActive(): boolean {
  if (!isBrowser()) return false;
  return sessionStorage.getItem(SESSION_KEY) === "1";
}

export function lockSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SESSION_KEY);
}

export async function resetPin(oldPin: string, newPin: string): Promise<boolean> {
  const ok = await verifyPin(oldPin);
  if (!ok) return false;
  await setPin(newPin);
  return true;
}

// 힌트 질문/답변
export interface HintData {
  question: string;
  answerHash: string;
}

export async function setHint(question: string, answer: string): Promise<void> {
  const answerHash = await sha256(answer.trim().toLowerCase());
  const data: HintData = { question, answerHash };
  localStorage.setItem(HINT_KEY, JSON.stringify(data));
}

export function getHintQuestion(): string | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(HINT_KEY);
    if (!data) return null;
    return (JSON.parse(data) as HintData).question;
  } catch {
    return null;
  }
}

export function hasHintSet(): boolean {
  if (!isBrowser()) return false;
  return !!localStorage.getItem(HINT_KEY);
}

export async function verifyHintAnswer(answer: string): Promise<boolean> {
  if (!isBrowser()) return false;
  try {
    const data = localStorage.getItem(HINT_KEY);
    if (!data) return false;
    const { answerHash } = JSON.parse(data) as HintData;
    const hash = await sha256(answer.trim().toLowerCase());
    return hash === answerHash;
  } catch {
    return false;
  }
}

// 힌트 답변으로 PIN 재설정
export async function resetPinWithHint(
  answer: string,
  newPin: string
): Promise<boolean> {
  const ok = await verifyHintAnswer(answer);
  if (!ok) return false;
  await setPin(newPin);
  return true;
}

function isBrowser() {
  return typeof window !== "undefined";
}

// 보유 종목
export function getStocks(): Stock[] {
  if (!isBrowser()) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.STOCKS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveStocks(stocks: Stock[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
}

export function addStock(stock: Stock): void {
  const stocks = getStocks();
  stocks.push(stock);
  saveStocks(stocks);
}

export function removeStock(id: string): void {
  const stocks = getStocks().filter((s) => s.id !== id);
  saveStocks(stocks);
}

// 일일 브리핑
export function getDailyBriefing(): DailyBriefing | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DAILY_BRIEFING);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveDailyBriefing(briefing: DailyBriefing): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.DAILY_BRIEFING, JSON.stringify(briefing));
}

// 주간 이슈
export function getWeeklyIssues(): WeeklyIssues | null {
  if (!isBrowser()) return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.WEEKLY_ISSUES);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveWeeklyIssues(issues: WeeklyIssues): void {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEYS.WEEKLY_ISSUES, JSON.stringify(issues));
}

// 캡처
export function getCaptures(date: string): StockCaptures[] {
  if (!isBrowser()) return [];
  try {
    const key = `${STORAGE_KEYS.CAPTURES}_${date}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveCapture(
  date: string,
  stockId: string,
  slot: string,
  imageData: string
): void {
  if (!isBrowser()) return;
  const key = `${STORAGE_KEYS.CAPTURES}_${date}`;
  const captures = getCaptures(date);
  let stockCapture = captures.find((c) => c.stockId === stockId);
  if (!stockCapture) {
    stockCapture = { stockId, date, captures: {} };
    captures.push(stockCapture);
  }
  (stockCapture.captures as Record<string, unknown>)[slot] = {
    slot,
    imageData,
    uploadedAt: new Date().toISOString(),
  };
  localStorage.setItem(key, JSON.stringify(captures));
}

export function saveCaptureAnalysis(
  date: string,
  stockId: string,
  slot: string,
  analysis: import("./types").CaptureAnalysis
): void {
  if (!isBrowser()) return;
  const key = `${STORAGE_KEYS.CAPTURES}_${date}`;
  const captures = getCaptures(date);
  const stockCapture = captures.find((c) => c.stockId === stockId);
  if (!stockCapture) return;
  const capture = (stockCapture.captures as Record<string, import("./types").Capture>)[slot];
  if (!capture) return;
  capture.analysis = analysis;
  capture.analyzing = false;
  localStorage.setItem(key, JSON.stringify(captures));
}

export function getCapturesByStock(date: string, stockId: string): import("./types").StockCaptures | null {
  const all = getCaptures(date);
  return all.find((c) => c.stockId === stockId) ?? null;
}

// 모든 종목의 오늘 최신 캡처 분석 결과 요약 (브리핑용)
export function getTodayCapturesSummary(date: string): Record<string, import("./types").CaptureAnalysis | null> {
  const all = getCaptures(date);
  const result: Record<string, import("./types").CaptureAnalysis | null> = {};
  all.forEach((sc) => {
    // 마감 > 장중 > 아침 순으로 최신 분석 우선
    const priority: import("./types").CaptureSlot[] = ["close", "midday", "morning"];
    let found: import("./types").CaptureAnalysis | null = null;
    for (const slot of priority) {
      const cap = sc.captures[slot];
      if (cap?.analysis) { found = cap.analysis; break; }
    }
    result[sc.stockId] = found;
  });
  return result;
}
