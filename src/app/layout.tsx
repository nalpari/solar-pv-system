import type { Metadata } from "next";
import { Figtree, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

// 로컬 woff2 기반 Noto Sans JP — basePath 자동 적용(자산 경로를 Next 가 관리)
const notoSansJP = localFont({
  variable: "--font-noto-sans-jp",
  src: [
    { path: "../../public/assets/fonts/NotoSansJP-Light.woff2", weight: "300", style: "normal" },
    { path: "../../public/assets/fonts/NotoSansJP-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/assets/fonts/NotoSansJP-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/assets/fonts/NotoSansJP-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/assets/fonts/NotoSansJP-Bold.woff2", weight: "700", style: "normal" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Solar PV Planner - 屋上パネルレイアウト設計ツール",
  description:
    "衛星画像を使用して建物の屋上にソーラーパネルのレイアウトを設計します。パネル数の計算と発電量の見積もりが可能です。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${figtree.variable} ${notoSansJP.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
