import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "주식 모닝 브리핑",
  description: "매일 아침 AI 주식 브리핑",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "모닝브리핑" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7c3aed",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/icon.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-gray-100">
        <div className="min-h-screen flex justify-center">
          <div className="w-full max-w-[390px] bg-white min-h-screen shadow-sm">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
