"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Breadcrumbs,
  PageIntro,
  ProfileSnapshot,
  SiteShell,
} from "../platform-components";

export function ToolPageShell({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <SiteShell active="/tools">
      <div className="platform-page tool-detail-page">
        <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "数据工具", href: "/tools" }, { label: title }]} />
        <PageIntro
          eyebrow={eyebrow}
          title={title}
          description={description}
          actions={<Link className="secondary-link" href="/tools">返回工具箱</Link>}
        />
        <ProfileSnapshot compact />
        {children}
      </div>
    </SiteShell>
  );
}
