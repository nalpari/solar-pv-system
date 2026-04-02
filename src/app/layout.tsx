import type { Metadata } from "next";
import { Figtree, Noto_Sans_JP, Geist_Mono } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
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
