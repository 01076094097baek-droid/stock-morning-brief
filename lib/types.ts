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

export interface CaptureAnalysis {
  stockName?: string;      // 추출된 종목명
  currentPrice?: string;   // 현재가 (예: "75,400원", "$182.50")
  changeRate?: string;     // 등락률 (예: "+1.23%", "-0.85%")
  avgPrice?: string;       // 평단가
  returnRate?: string;     // 수익률 (예: "+15.3%", "-5.2%")
  evaluationAmount?: string; // 평가금액
  quantity?: string;       // 보유수량
  analysisText?: string;   // AI 한줄 분석
  appType?: string;        // 인식된 앱 (예: "키움증권", "Robinhood")
}

export interface Capture {
  slot: CaptureSlot;
  imageData: string; // base64 (압축)
  uploadedAt: string;
  analysis?: CaptureAnalysis;
  analyzing?: boolean;
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
