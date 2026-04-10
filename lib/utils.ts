import { StockJudgment, StockType, IssueTag } from "./types";

export function formatDate(date: Date): string {
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getThisMondayString(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// 판단 뱃지 스타일
export function getJudgmentStyle(judgment: StockJudgment): {
  label: string;
  bg: string;
  text: string;
  border: string;
} {
  switch (judgment) {
    case "hold":
      return {
        label: "유지권장",
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
      };
    case "monitor":
      return {
        label: "모니터링필요",
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
      };
    case "sell":
      return {
        label: "매도검토",
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
      };
  }
}

// 종목 유형 뱃지
export function getStockTypeStyle(type: StockType): {
  label: string;
  bg: string;
  text: string;
} {
  switch (type) {
    case "growth":
      return { label: "성장주", bg: "bg-blue-100", text: "text-blue-700" };
    case "value":
      return { label: "가치주", bg: "bg-green-100", text: "text-green-700" };
    case "rebound":
      return { label: "반등주", bg: "bg-orange-100", text: "text-orange-700" };
    case "dividend":
      return { label: "배당주", bg: "bg-purple-100", text: "text-purple-700" };
  }
}

// 이슈 태그 스타일
export function getIssueTagStyle(tag: IssueTag): {
  label: string;
  bg: string;
  text: string;
} {
  switch (tag) {
    case "risk":
      return { label: "리스크", bg: "bg-red-100", text: "text-red-700" };
    case "caution":
      return { label: "주의", bg: "bg-amber-100", text: "text-amber-700" };
    case "watch":
      return { label: "주시", bg: "bg-blue-100", text: "text-blue-700" };
  }
}

// 뉴스 카테고리 스타일
export function getNewsCategoryStyle(category: "KR" | "US" | "MACRO"): {
  label: string;
  bg: string;
  text: string;
} {
  switch (category) {
    case "KR":
      return { label: "한국", bg: "bg-blue-100", text: "text-blue-700" };
    case "US":
      return { label: "미국", bg: "bg-purple-100", text: "text-purple-700" };
    case "MACRO":
      return { label: "매크로", bg: "bg-gray-100", text: "text-gray-600" };
  }
}

export function getCountryFlag(country: "KR" | "US"): string {
  return country === "KR" ? "🇰🇷" : "🇺🇸";
}

export function formatPrice(price: number, currency: "KRW" | "USD"): string {
  if (currency === "KRW") {
    return price.toLocaleString("ko-KR") + "원";
  }
  return "$" + price.toFixed(2);
}
