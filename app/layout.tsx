import type { Metadata } from "next";
import "./globals.css";
import "./workspace-design.css";
import { PlatformProvider } from "./platform-state";

const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const isGitHubPagesBuild =
  process.env.GITHUB_ACTIONS === "true" && repositoryName.length > 0;
const publicBasePath = isGitHubPagesBuild ? `/${repositoryName}` : "";
const publicSiteUrl = isGitHubPagesBuild
  ? "https://atlas13-yx.github.io/"
  : "http://localhost:3000/";

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteUrl),
  title: "蒙志愿｜内蒙古高考志愿智能决策平台",
  description:
    "面向内蒙古新高考的多界面志愿决策平台，连接考生档案、智能匹配、院校专业组、志愿表与数据工具。",
  icons: {
    icon: `${publicBasePath}/favicon.svg`,
    shortcut: `${publicBasePath}/favicon.svg`,
  },
  openGraph: {
    title: "蒙志愿｜内蒙古高考志愿智能决策平台",
    description: "从考生档案到志愿表，把每一步选择依据讲清楚。",
    type: "website",
    locale: "zh_CN",
    images: [`${publicBasePath}/og-platform-v2.png`],
  },
  twitter: {
    card: "summary_large_image",
    title: "蒙志愿｜内蒙古高考志愿智能决策平台",
    description: "从考生档案到志愿表，把每一步选择依据讲清楚。",
    images: [`${publicBasePath}/og-platform-v2.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <PlatformProvider>{children}</PlatformProvider>
      </body>
    </html>
  );
}
