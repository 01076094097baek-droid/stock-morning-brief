import { Stock, DailyBriefing, Capture, CaptureSlot, STORAGE_KEYS } from "./types";

// ─── PIN auth ─────────────────────────────────────────────────────────────────
export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.PIN, await sha256(pin));
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(STORAGE_KEYS.PIN);
  if (!stored) return false;
  return stored === (await sha256(pin));
}

export function hasPin(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.PIN);
}

// ─── Session ──────────────────────────────────────────────────────────────────
export function isSessionActive(): boolean {
  return sessionStorage.getItem(STORAGE_KEYS.SESSION) === "1";
}

export function startSession(): void {
  sessionStorage.setItem(STORAGE_KEYS.SESSION, "1");
}

export function lockSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
}

// ─── Hint ─────────────────────────────────────────────────────────────────────
export function setHint(question: string, answer: string): void {
  localStorage.setItem(STORAGE_KEYS.HINT_Q, question);
  localStorage.setItem(STORAGE_KEYS.HINT_A, answer.trim().toLowerCase());
}

export function getHintQuestion(): string | null {
  return localStorage.getItem(STORAGE_KEYS.HINT_Q);
}

export function hasHint(): boolean {
  return !!localStorage.getItem(STORAGE_KEYS.HINT_Q);
}

export function verifyHintAnswer(answer: string): boolean {
  return localStorage.getItem(STORAGE_KEYS.HINT_A) === answer.trim().toLowerCase();
}

export async function resetPinWithHint(answer: string, newPin: string): Promise<boolean> {
  if (!verifyHintAnswer(answer)) return false;
  await setPin(newPin);
  return true;
}

// ─── Stocks ───────────────────────────────────────────────────────────────────
export function getStocks(): Stock[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.STOCKS) || "[]");
  } catch {
    return [];
  }
}

export function saveStocks(stocks: Stock[]): void {
  localStorage.setItem(STORAGE_KEYS.STOCKS, JSON.stringify(stocks));
}

// ─── Briefing ─────────────────────────────────────────────────────────────────
export function getBriefing(): DailyBriefing | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BRIEFING);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveBriefing(b: DailyBriefing): void {
  localStorage.setItem(STORAGE_KEYS.BRIEFING, JSON.stringify(b));
}

// ─── Captures (today only) ────────────────────────────────────────────────────
interface CaptureStore {
  date: string;
  captures: Capture[];
}

function getCaptureStore(): CaptureStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAPTURES);
    if (!raw) return { date: "", captures: [] };
    return JSON.parse(raw);
  } catch {
    return { date: "", captures: [] };
  }
}

export function getTodayCaptures(): Capture[] {
  const today = new Date().toISOString().split("T")[0];
  const store = getCaptureStore();
  return store.date === today ? store.captures : [];
}

export function saveCapture(capture: Capture): void {
  const today = new Date().toISOString().split("T")[0];
  const existing = getTodayCaptures();
  const updated = [...existing.filter((c) => c.slot !== capture.slot), capture];
  localStorage.setItem(STORAGE_KEYS.CAPTURES, JSON.stringify({ date: today, captures: updated }));
}

export function removeCapture(slot: CaptureSlot): void {
  const today = new Date().toISOString().split("T")[0];
  const updated = getTodayCaptures().filter((c) => c.slot !== slot);
  localStorage.setItem(STORAGE_KEYS.CAPTURES, JSON.stringify({ date: today, captures: updated }));
}
