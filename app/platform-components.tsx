"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { lookupRank } from "./score-ranks";
import { calculateFit, calculateRisk } from "./decision-engine";
import {
  OFFICIAL_GAOKAO_URL,
  type SchoolGroup,
} from "./platform-data";
import { isGroupEligible, usePlatform } from "./platform-state";

const navigation = [
  { href: "/", label: "首页" },
  { href: "/smart", label: "智能选志愿" },
  { href: "/schools", label: "院校专业组" },
  { href: "/special", label: "特殊招生" },
  { href: "/notices", label: "公告日历" },
  { href: "/volunteer-list", label: "志愿表" },
  { href: "/tools", label: "数据工具" },
] as const;

export function SiteShell({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const { profile, savedIds, profileConfigured } = usePlatform();
  const rank = lookupRank(profile.firstSubject, Number(profile.score));
  const rankRange = rank
    ? `${rank.rangeStart.toLocaleString("zh-CN")}—${rank.rangeEnd.toLocaleString("zh-CN")}`
    : "—";
  return (
    <>
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <div className="official-strip platform-strip">
        <span>
          内蒙古 · 2026 招生资料
        </span>
        <span className="candidate-context">
          {profileConfigured ? `${profile.firstSubject}类 · ${profile.score} 分 · 同分位次 ${rankRange}` : "先录入成绩与选科，建立自己的方案"}
          <Link href="/profile">{profileConfigured ? "修改档案" : "填写档案"}</Link>
        </span>
      </div>

      <header className="site-header platform-header">
        <Link className="brand" href="/" aria-label="返回蒙志愿首页">
          <span className="brand-mark">蒙</span>
          <span>
            <strong>蒙志愿</strong>
            <small>内蒙古高考志愿智能决策平台</small>
          </span>
        </Link>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <Link
              className={active === item.href ? "active" : ""}
              href={item.href}
              key={item.href}
              aria-current={active === item.href ? "page" : undefined}
            >
              {item.label}
              {item.href === "/volunteer-list" && savedIds.length > 0 && (
                <em className="nav-count">{savedIds.length}</em>
              )}
            </Link>
          ))}
        </nav>
        <a
          className="safe-gaokao"
          href={OFFICIAL_GAOKAO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="打开内蒙古招生考试信息网平安高考"
        >
          <span className="hand">官</span>
          <span>
            <small>考试院官方服务</small>
            平安高考
          </span>
          <b>↗</b>
        </a>
      </header>

      <main id="main-content">{children}</main>

      <footer>
        <Link className="brand footer-brand" href="/">
          <span className="brand-mark">蒙</span>
          <span>
            <strong>蒙志愿</strong>
            <small>先看懂规则，再做选择</small>
          </span>
        </Link>
        <p>
          本平台为高考志愿辅助工具，不替代官方填报系统，不承诺录取结果。
          <br />
          2026 计划与 2025 分数按来源标注；档案和草稿保存在当前浏览器。
        </p>
        <span>© 2026 蒙志愿</span>
      </footer>
    </>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="page-intro">
      <div>
        <span className="hero-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="page-intro-actions">{actions}</div>}
    </section>
  );
}

export function Breadcrumbs({
  items,
}: {
  items: Array<{ label: string; href?: string }>;
}) {
  return (
    <nav className="breadcrumbs" aria-label="面包屑导航">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`}>
          {item.href ? <Link href={item.href}>{item.label}</Link> : item.label}
          {index < items.length - 1 && <b>›</b>}
        </span>
      ))}
    </nav>
  );
}

export function DataNotice({ children, label = "产品演示数据", kind = "demo" }: { children?: ReactNode; label?: string; kind?: "demo" | "official" | "reference" }) {
  return (
    <div className={`data-note platform-data-note data-note-${kind}`}>
      <span>{label}</span>
      {children ?? "匹配结果用于展示决策流程，不作为实际填报依据；正式数据以考试院招生计划为准。"}
    </div>
  );
}

export function ProfileSnapshot({ compact = false }: { compact?: boolean }) {
  const { profile, profileConfigured } = usePlatform();
  const rank = lookupRank(profile.firstSubject, Number(profile.score));
  const rankRange = rank
    ? `${rank.rangeStart.toLocaleString("zh-CN")}—${rank.rangeEnd.toLocaleString("zh-CN")}`
    : "—";
  return (
    <aside className={`context-card ${compact ? "compact" : ""}`}>
      <div className="context-card-head">
        <div>
          <span>{profileConfigured ? "当前考生档案 · 2026" : "示例档案 · 尚未填写"}</span>
          <strong>{profileConfigured ? `${profile.firstSubject}类 · ${[profile.firstSubject, ...profile.secondSubjects].join("＋")}` : "填写自己的成绩与选科后再做判断"}</strong>
        </div>
        <Link href="/profile">修改</Link>
      </div>
      <div className="context-metrics">
        <div><b>{profileConfigured ? profile.score : "待填写"}</b><span>高考成绩</span></div>
        <div><b>{profileConfigured ? rankRange : "—"}</b><span>2026 同分位次区间</span></div>
        <div><b>{profileConfigured ? profile.city || "未填写" : "—"}</b><span>所在盟市</span></div>
      </div>
    </aside>
  );
}

export function GroupCard({ group, fitOverride }: { group: SchoolGroup; fitOverride?: number }) {
  const { profile, isSaved, toggleSaved, hydrated } = usePlatform();
  const eligible = isGroupEligible(group, profile);
  const saved = isSaved(group.id);
  const dynamicRisk = calculateRisk(group, profile);
  const dynamicFit = fitOverride ?? calculateFit(group, profile);
  const riskClass = dynamicRisk === "冲" ? "rush" : dynamicRisk === "稳" ? "steady" : "safe";
  return (
    <article className="result-card">
      <div className="result-card-top">
        <span className={`risk-badge ${riskClass}`}>{dynamicRisk}</span>
        <div>
          <Link href={`/schools/detail?school=${group.id}`} className="result-school">
            {group.school}
          </Link>
          <p>{group.location} · {group.type} · {group.tags.join(" · ")}</p>
        </div>
        <strong className="fit-score">{dynamicFit}%<small>偏好匹配</small></strong>
      </div>
      <div className="result-group">
        <div><span>院校专业组</span><strong>{group.group}</strong></div>
        <div><span>代表专业</span><strong>{group.majors.join("、")}</strong></div>
        <div><span>计划变化</span><strong className={group.change > 0 ? "up" : ""}>{group.change > 0 ? `+${group.change}` : group.change || "持平"}</strong></div>
      </div>
      <div className={`eligibility ${eligible ? "eligible" : "blocked"}`}>
        {eligible
          ? `✓ 当前选科符合：${group.requirements.join("＋")}`
          : `! 当前选科不符合：要求 ${group.requirements.join("＋")}`}
      </div>
      <div className="result-actions">
        <Link className="secondary-action" href={`/schools/detail?school=${group.id}`}>查看依据</Link>
        <button
          className={saved ? "saved" : "primary-action"}
          type="button"
          onClick={() => toggleSaved(group.id)}
          disabled={!hydrated || (!eligible && !saved)}
        >
          {!hydrated ? "正在恢复档案…" : saved ? "已加入志愿表 ✓" : eligible ? "加入志愿表" : "选科不符合"}
        </button>
      </div>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="platform-empty">
      <span>蒙</span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
