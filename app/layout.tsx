import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주식 모닝 브리핑",
  description: "AI가 매일 아침 분석해주는 내 주식 브리핑",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="min-h-screen flex justify-center bg-gray-100">
          <div className="w-full max-w-[390px] bg-white min-h-screen relative shadow-sm">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
