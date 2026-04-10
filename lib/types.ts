// 보유 종목
export interface Stock {
  id: string;
  name: string;
  code: string; // 한국: 종목코드, 미국: 티커
  country: "KR" | "US";
  targetPrice?: number;
  stopLossPrice?: number;
  currency: "KRW" | "USD";
}

// AI 종목 판단
export type StockJudgment = "hold" | "monitor" | "sell";

// 종목별 브리핑 카드
export interface StockBriefing {
  stockId: string;
  stockName: string;
  country: "KR" | "US";
  judgment: StockJudgment;
  summary: string;
  newsPreview: string[];
  currentPrice?: string;
  returnRate?: string;
}

// 뉴스 아이템
export interface NewsItem {
  id: string;
  stockId?: string;
  stockName?: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "KR" | "US" | "MACRO";
}

// 추천 종목
export type StockType = "growth" | "value" | "rebound" | "dividend";

export interface RecommendedStock {
  name: string;
  code: string;
  country: "KR" | "US";
  type: StockType;
  reason: string;
  bullets: string[];
  targetPrice: string;
}

// 주간 이슈
export type IssueTag = "risk" | "caution" | "watch";

export interface WeeklyIssue {
  id: string;
  title: string;
  description: string;
  relatedStocks: { stockName: string; tag: IssueTag }[];
}

// 일일 브리핑 데이터
export interface DailyBriefing {
  date: string; // YYYY-MM-DD
  generatedAt: string; // ISO timestamp
  marketSummary: string;
  stockBriefings: StockBriefing[];
  recommendedStocks: RecommendedStock[];
  news: NewsItem[];
}

// 주간 이슈 데이터
export interface WeeklyIssues {
  weekStart: string; // YYYY-MM-DD (월요일)
  generatedAt: string;
  issues: WeeklyIssue[];
}

// 캡처 슬롯
export type CaptureSlot = "morning" | "midday" | "close";

export interface Capture {
  slot: CaptureSlot;
  imageData: string; // base64
  uploadedAt: string;
  analysis?: string;
}

export interface StockCaptures {
  stockId: string;
  date: string;
  captures: Partial<Record<CaptureSlot, Capture>>;
}

// localStorage 키
export const STORAGE_KEYS = {
  STOCKS: "smb_stocks",
  DAILY_BRIEFING: "smb_daily_briefing",
  WEEKLY_ISSUES: "smb_weekly_issues",
  CAPTURES: "smb_captures",
} as const;
