"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { lookupRank } from "./score-ranks";
import { OFFICIAL_GAOKAO_URL, specialTracks, toolRoutes } from "./platform-data";
import { usePlatform } from "./platform-state";
import { SiteShell } from "./platform-components";
import { admissionsAsset, formatNumber, type AdmissionsCatalog } from "./admissions-data";
import { useAnnouncements, formatNoticeTime } from "./notice-data";

const steps = [
  { number: "01", title: "填写考生档案", text: "成绩、选科、地域与预算", href: "/profile" },
  { number: "02", title: "筛选院校专业组", text: "逐组查看计划与限制条件", href: "/schools" },
  { number: "03", title: "比较组内差异", text: "专业、计划、学费与限制", href: "/tools/compare" },
  { number: "04", title: "整理志愿草稿", text: "排序、检查、导出备份", href: "/volunteer-list" },
];

export default function Home() {
  const router = useRouter();
  const { profile, savedIds, profileConfigured } = usePlatform();
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<AdmissionsCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const { data: noticeFeed, loading: noticesLoading, error: noticeError } = useAnnouncements();
  useEffect(() => {
    const controller = new AbortController();
    fetch(admissionsAsset("/data/admissions-2026/catalog.json"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("catalog unavailable");
        return response.json() as Promise<AdmissionsCatalog>;
      })
      .then(setCatalog)
      .catch((reason) => {
        if (reason?.name !== "AbortError") setCatalogError(true);
      });
    return () => controller.abort();
  }, []);

  const rank = profileConfigured ? lookupRank(profile.firstSubject, Number(profile.score)) : null;
  const rankRange = rank ? `${formatNumber(rank.rangeStart)}—${formatNumber(rank.rangeEnd)}` : "—";
  const previewSchools = catalog?.schools.filter((school) =>
    ["内蒙古大学", "内蒙古工业大学", "内蒙古农业大学"].includes(school.name)
  ).slice(0, 3) ?? [];

  function search(event: FormEvent) {
    event.preventDefault();
    router.push(`/schools?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <SiteShell active="/">
      <div className="dashboard">
        <div className="dashboard-heading">
          <div><span className="section-kicker">我的报考工作台</span><h1>把每一个专业组，选明白。</h1></div>
          <div className="year-label"><b>2026</b><span>招生资料年度<br />2027 数据待官方发布</span></div>
        </div>

        <section className="dashboard-top">
          <div className="search-workbench">
            <div className="workbench-label"><span>官方计划 · 组内专业 · 历史分数</span><Link href="/notices">查看公告日历 ↗</Link></div>
            <h2>从一所心仪的院校开始</h2>
            <form onSubmit={search} className="dashboard-search" role="search">
              <label className="visually-hidden" htmlFor="home-search">搜索院校名称或代号</label>
              <span aria-hidden="true">⌕</span>
              <input id="home-search" type="search" placeholder="输入院校名称或院校代号" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button type="submit">查院校</button>
            </form>
            <div className="search-suggestions"><span>快速查询</span>{["内蒙古大学", "内蒙古工业大学", "北京大学"].map((school) => <Link key={school} href={`/schools?q=${encodeURIComponent(school)}`}>{school}</Link>)}</div>
            <div className="workbench-metrics" aria-live="polite">
              <div><strong>{formatNumber(catalog?.meta.schoolCount)}</strong><span>院校招生单元</span></div>
              <div><strong>{formatNumber(catalog?.meta.offeringCount)}</strong><span>专业组 / 招生单元</span></div>
              <div><strong>{formatNumber(catalog?.meta.majorRowCount)}</strong><span>专业计划行</span></div>
              <div><strong>{formatNumber(catalog?.meta.correctionCount)}</strong><span>已收录刊误公告</span></div>
            </div>
            <p className="snapshot-note">{catalogError ? "计划数据暂时无法载入，可进入院校库重试。" : catalog ? `当前为 ${catalog.meta.year} 年数据快照 · 整理于 ${formatNoticeTime(catalog.meta.generatedAt)}` : "正在读取招生计划…"}</p>
          </div>

          <aside className="candidate-card">
            <div className="candidate-card-heading"><h2>我的 2026 志愿档案</h2><Link href="/profile">{profileConfigured ? "编辑" : "填写"}</Link></div>
            <span className="local-state">{profileConfigured ? "已保存于本机" : "尚未填写个人档案"}</span>
            <div className="candidate-score"><div><strong>{profileConfigured ? profile.score : "—"}</strong><span>高考成绩</span></div><div><strong>{rankRange}</strong><span>2026 同分位次区间</span></div></div>
            <p>{profileConfigured ? [profile.firstSubject, ...profile.secondSubjects].join(" / ") : "录入选科后，可在专业组内检查选科要求。"}</p>
            <Link className="candidate-next" href={profileConfigured ? "/smart" : "/profile"}>{profileConfigured ? "用我的条件筛选" : "建立我的档案"} <span>→</span></Link>
            <Link className="candidate-saved" href="/volunteer-list"><span>志愿草稿</span><b>{savedIds.length} 个已选 <span>›</span></b></Link>
          </aside>
        </section>

        <a className="official-gateway" href={OFFICIAL_GAOKAO_URL} target="_blank" rel="noreferrer">
          <span className="official-gateway-mark" aria-hidden="true">官</span>
          <div><span>内蒙古招生考试信息网</span><strong>平安高考</strong></div>
          <p>招生政策 · 信息查询 · 志愿填报 · 录取查询</p>
          <span className="official-gateway-action">进入官方服务 <b>↗</b></span>
        </a>

        <section aria-label="填报准备步骤" className="dashboard-journey">{steps.map((step, index) => <Link key={step.number} href={step.href} className={index === 0 && profileConfigured ? "step-done" : ""}><span>{index === 0 && profileConfigured ? "✓" : step.number}</span><div><strong>{step.title}</strong><small>{step.text}</small></div><b aria-hidden="true">›</b></Link>)}</section>

        <div className="dashboard-middle">
          <section className="dashboard-panel">
            <div className="dashboard-section-head"><div><span className="section-kicker">先核资格，再看院校</span><h2>特殊招生，各有一条路</h2></div><Link href="/special">全部类型 →</Link></div>
            <div className="track-list">{specialTracks.map((track, index) => <Link href={`/special?type=${track.id}`} key={track.id}><span className={`track-symbol track-${index}`}>{track.icon}</span><div><strong>{track.title}</strong><small>{track.subtitle}</small></div><b>›</b></Link>)}</div>
          </section>

          <section className="dashboard-panel home-announcements">
            <div className="dashboard-section-head"><div><span className="section-kicker">保留原文与发布时间</span><h2>公告与日程</h2></div><Link href="/notices">日历总览 →</Link></div>
            <div className="home-notice-state">最近整理：{noticeFeed ? formatNoticeTime(noticeFeed.lastSuccessfulSync ?? noticeFeed.updatedAt) : noticesLoading ? "读取中…" : "暂无记录"}</div>
            {noticeError ? <div className="dashboard-inline-empty"><p>公告暂时未能载入。</p><Link href="/notices">进入公告中心重试</Link></div> : noticeFeed?.items.length ? <div className="dashboard-notices">{noticeFeed.items.slice(0, 3).map((notice) => <a key={notice.url + notice.title} href={notice.url} target="_blank" rel="noreferrer"><time>{notice.date || "日期待核验"}</time><div><span>{notice.category}</span><strong>{notice.title}</strong></div><b>↗</b></a>)}</div> : <p className="snapshot-note">{noticesLoading ? "正在读取官方公告…" : "尚无已收录的公告，请查看考试院原文。"}</p>}
            <Link className="home-calendar-link" href="/notices">查看采集窗口、事项时间线和全部来源 <span>→</span></Link>
          </section>
        </div>

        <section className="dashboard-panel">
          <div className="dashboard-section-head"><div><span className="section-kicker">来自已接入的 2026 招生计划</span><h2>区内院校 · 专业组预览</h2></div><Link href="/schools">完整院校库 →</Link></div>
          <div className="dashboard-school-grid">{previewSchools.map((school) => <Link href={`/schools/detail?school=${encodeURIComponent(school.id)}`} key={school.id}><span className="school-monogram" aria-hidden="true">{school.name.replace("内蒙古", "").slice(0, 1)}</span><div><small>院校代号 {school.code}</small><h3>{school.name}</h3></div><p>{school.subjects.slice(0, 3).join(" · ")}</p><div className="school-preview-stats"><span><b>{formatNumber(school.groupCount)}</b> 招生单元</span><span><b>{formatNumber(school.planCount)}</b> 计划数</span></div><span className="school-preview-action">查看组内专业与历年记录 →</span></Link>)}</div>
          {previewSchools.length === 0 && <p className="snapshot-note">{catalogError ? "院校摘要暂时无法载入，可进入完整院校库重试。" : "正在载入区内院校…"}</p>}
        </section>

        <section className="dashboard-tools">
          <div className="dashboard-section-head"><div><span className="section-kicker">按需要使用</span><h2>决策工具</h2></div><Link href="/tools">查看数据口径 →</Link></div>
          <div>{toolRoutes.map((tool) => <Link key={tool.href} href={tool.href}><span>{tool.icon}</span><strong>{tool.title}</strong><small>{tool.subtitle}</small></Link>)}</div>
        </section>
        <div className="dashboard-footnote"><span>数据说明</span><p>2026 招生计划、2025 历史分数分别展示。跨年专业组需核对专业构成；草稿可导出备份，正式志愿请在考试院系统提交。</p><Link href="/schools">查看来源 →</Link></div>
      </div>
    </SiteShell>
  );
}
