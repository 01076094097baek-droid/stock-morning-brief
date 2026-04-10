import {
  Stock,
  DailyBriefing,
  WeeklyIssues,
  StockCaptures,
  STORAGE_KEYS,
} from "./types";

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
