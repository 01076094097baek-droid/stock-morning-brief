export interface Stock {
  id: string;
  name: string;
  code: string;
  country: "KR" | "US";
  targetPrice?: string;
  stopLossPrice?: string;
}

export interface StockBriefing {
  stockId: string;
  stockName: string;
  country: "KR" | "US";
  judgment: "hold" | "monitor" | "sell";
  summary: string;
  currentPrice?: string | null;
  returnRate?: string | null;
  newsPreview?: string[];
}

export interface RecommendedStock {
  name: string;
  code: string;
  country: "KR" | "US";
  type: "growth" | "value" | "rebound" | "dividend";
  reason: string;
  bullets: string[];
  targetPrice?: string;
}

export interface NewsItem {
  id: string;
  stockId?: string | null;
  stockName?: string | null;
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  category: "KR" | "US" | "MACRO";
}

export interface WeeklyIssue {
  id: string;
  title: string;
  description: string;
  relatedStocks: { stockName: string; tag: "risk" | "caution" | "watch" }[];
}

export interface DailyBriefing {
  date: string;
  generatedAt: string;
  marketSummary: string;
  stockBriefings: StockBriefing[];
  recommendedStocks: RecommendedStock[];
  news: NewsItem[];
  weeklyIssues?: WeeklyIssue[];
}

export interface CaptureAnalysis {
  stockName?: string;
  currentPrice?: string;
  changeRate?: string;
  avgPrice?: string;
  returnRate?: string;
  evaluationAmount?: string;
  quantity?: string;
  analysisText?: string;
  appType?: string;
}

export interface CaptureNewsItem {
  title: string;
  summary: string;
  source?: string;
  url?: string;
}

export interface CaptureDeepAnalysis {
  opinion: "buy" | "hold" | "sell";
  opinionReasons: string[];
  targetPrice?: string | null;
  stopLossPrice?: string | null;
  risks: string[];
  chartAnalysis: string;
  marketContext: string;
  newsItems: CaptureNewsItem[];
  summary: string;
}

export type CaptureSlot = "morning" | "midday" | "close";

export const SLOT_META: Record<CaptureSlot, { label: string; time: string; emoji: string }> = {
  morning: { label: "아침", time: "09:00", emoji: "🌅" },
  midday:  { label: "장중", time: "12:00", emoji: "📊" },
  close:   { label: "마감", time: "15:30", emoji: "🔔" },
};

export interface Capture {
  slot: CaptureSlot;
  imageData: string;
  analysis?: CaptureAnalysis;
  deepAnalysis?: CaptureDeepAnalysis;
  capturedAt: string;
}

export const STORAGE_KEYS = {
  PIN:       "smb_pin",
  HINT_Q:    "smb_hint_q",
  HINT_A:    "smb_hint_a",
  SESSION:   "smb_session",
  STOCKS:    "smb_stocks",
  BRIEFING:  "smb_briefing",
  CAPTURES:  "smb_captures",
} as const;
