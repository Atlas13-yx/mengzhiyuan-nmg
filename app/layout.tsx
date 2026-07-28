import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "蒙志愿｜内蒙古高考志愿智能决策平台",
  description:
    "以内蒙古自治区教育考试院官方信息为底座，提供公告时间线、院校专业组对比、特殊招生入口与 AI 语音筛选。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "蒙志愿｜内蒙古高考志愿智能决策平台",
    description: "看懂院校专业组，排好每一份志愿。",
    type: "website",
    locale: "zh_CN",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "蒙志愿｜内蒙古高考志愿智能决策平台",
    description: "看懂院校专业组，排好每一份志愿。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
