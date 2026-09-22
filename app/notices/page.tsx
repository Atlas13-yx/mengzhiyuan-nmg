"use client";

import { useEffect, useMemo, useState } from "react";
import { OFFICIAL_GAOKAO_URL } from "../platform-data";
import { Breadcrumbs, DataNotice, PageIntro, SiteShell } from "../platform-components";
import { admissionCalendar, formatNoticeTime, getSyncState, useAnnouncements, type AdmissionEvent } from "../notice-data";
import "./notices.css";

const categories = ["全部", "志愿公告", "招生计划", "特殊招生", "数据发布", "政策资讯"];
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function eventStatus(event: AdmissionEvent, now: Date | null) {
  if (!now) return "已公布";
  if (now.getTime() > Date.parse(event.endsAt)) return "已结束";
  if (now.getTime() < Date.parse(event.startsAt)) return "尚未开始";
  return "日程窗口内";
}

function eventDate(value: string) {
  return `${Number(value.slice(5, 7))} 月 ${Number(value.slice(8, 10))} 日 ${value.slice(11, 16)}`;
}

function EventCard({ event, now }: { event: AdmissionEvent; now: Date | null }) {
  const status = eventStatus(event, now);
  return (
    <article className={`notice-event ${status === "日程窗口内" ? "in-progress" : ""}`}>
      <div className="notice-event-line"><span>{status}</span><small>2026 已公布安排</small></div>
      <h3>{event.title}</h3>
      <p className="notice-event-time"><time dateTime={event.startsAt}>{eventDate(event.startsAt)}</time><span>至</span><time dateTime={event.endsAt}>{eventDate(event.endsAt)}</time></p>
      <p>{event.detail}</p>
      <div className="notice-event-footer"><small>{event.audience}</small><a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceLabel} ↗</a></div>
    </article>
  );
}

export default function NoticesPage() {
  const { data, loading, error, reload } = useAnnouncements();
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("全部");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [month, setMonth] = useState("2026-08");
  const [selectedDay, setSelectedDay] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 60000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  const state = now ? getSyncState(data, now) : { kind: "pending", label: "正在核对采集状态", detail: "按北京时间核对采集窗口与最近成功记录。" };
  const years = useMemo(() => [...new Set(data.items.filter((item) => item.date).map((item) => item.date.slice(0, 4)))].sort().reverse(), [data.items]);
  const results = useMemo(() => data.items.filter((item) =>
    (category === "全部" || item.category === category) &&
    (year === "全部" || item.date.startsWith(year)) &&
    `${item.title} ${item.category}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ), [data.items, category, year, query]);
  const pageCount = Math.max(1, Math.ceil(results.length / 8));
  const currentPage = Math.min(page, pageCount);
  const pagedResults = results.slice((currentPage - 1) * 8, currentPage * 8);

  const monthDays = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const offset = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
    const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const cells = Array.from({ length: Math.ceil((offset + total) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= total ? `${month}-${String(day).padStart(2, "0")}` : "";
    });
    return cells;
  }, [month]);

  const monthEvents = admissionCalendar.filter((event) => event.startsAt.slice(0, 7) <= month && event.endsAt.slice(0, 7) >= month);
  const shownEvents = view === "list" ? admissionCalendar : monthEvents.filter((event) => !selectedDay || (event.startsAt.slice(0, 10) <= selectedDay && event.endsAt.slice(0, 10) >= selectedDay));

  function changeMonth(step: number) {
    const [y, m] = month.split("-").map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + step, 1)).toISOString().slice(0, 7));
    setSelectedDay("");
  }

  function resetSearch() { setCategory("全部"); setQuery(""); setYear("全部"); setPage(1); }

  return (
    <SiteShell active="/notices">
      <div className="platform-page notices-page">
        <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "公告与日程" }]} />
        <PageIntro eyebrow="ADMISSIONS BULLETIN" title="重要消息，不错过一步" description="把考试院公告、适用事项和填报日程放在一起。先看时间，再核条件，最后到官方系统完成填报。" actions={<a className="primary-link" href={OFFICIAL_GAOKAO_URL} target="_blank" rel="noreferrer">平安高考 · 官方入口 ↗</a>} />

        <section className="notice-status-grid" aria-label="公告数据状态">
          <div className={`notice-status-card state-${state.kind}`}><span>采集状态</span><strong><i />{state.label}</strong><p>{state.detail}</p></div>
          <div className="notice-status-card"><span>最近成功采集 · 北京时间</span><strong>{formatNoticeTime(data.lastSuccessfulSync)}</strong><p>采集窗口：{data.syncWindow.start} 至 {data.syncWindow.end}。窗口外保留历史记录。</p></div>
          <div className="notice-status-card"><span>可追溯的公告索引</span><strong>{data.items.length}<small> 条已收录</small></strong><p>来源：{data.sourceName}。逐条保留官网链接与日期依据。</p></div>
        </section>

        <DataNotice label="官方来源" kind="official">标题来自官网索引；日程为人工核对原文的 2026 年部分重要节点，不代表完整录取日历，也不适用于下一届。具体条件与最新调整请查看原文。</DataNotice>

        <section className="notice-layout">
          <div className="card notice-center-card">
            <div className="notice-section-heading"><div><span className="eyebrow">BULLETIN</span><h2>公告中心</h2></div><button className="notice-refresh" type="button" onClick={reload} disabled={loading}>{loading ? "读取中…" : "刷新公告 ↻"}</button></div>
            {error && <div className="notice-fetch-message" role="status">{error}，继续显示最近保存的数据。可稍后刷新或直接查看官方专题。</div>}
            {!data.verified && <div className="notice-fetch-message" role="status">当前缓存尚无成功采集凭据，条目需到官方页面核验。</div>}
            <div className="notice-toolbar">
              <label><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="搜索公告、批次或院校类型" aria-label="搜索公告" /></label>
              <div className="notice-category-tabs" aria-label="公告分类">{categories.map((item) => <button type="button" aria-pressed={category === item} className={category === item ? "active" : ""} onClick={() => { setCategory(item); setPage(1); }} key={item}>{item}</button>)}</div>
            </div>
            <div className="notice-result-toolbar"><span aria-live="polite">找到 <b>{results.length}</b> 条公告 · 按日期倒序</span><label>年份<select value={year} onChange={(event) => { setYear(event.target.value); setPage(1); }} aria-label="公告年份"><option value="全部">全部年份</option>{years.map((value) => <option value={value} key={value}>{value} 年</option>)}</select></label></div>
            <div className="notice-list platform-notice-list">
              {pagedResults.map((notice) => (
                <a href={notice.url} target="_blank" rel="noreferrer" key={`${notice.url}-${notice.title}`}>
                  <span className="notice-date"><b>{notice.date ? notice.date.slice(8, 10) : "—"}</b><small>{notice.date ? `${notice.date.slice(0, 4)}.${notice.date.slice(5, 7)}` : "日期待核"}</small></span>
                  <span className="notice-main"><em>{notice.category}</em><i className={notice.verification === "official-index" ? "notice-source-verified" : "notice-source-pending"}>{notice.verification === "official-index" ? "官网索引" : "待核验"}</i><strong>{notice.title}</strong><small>内蒙古自治区教育考试院{notice.dateSource === "article-url" ? " · 日期据原文地址" : notice.dateSource === "unknown" ? " · 发布日期待核验" : " · 官方列表日期"}</small></span>
                  <b aria-hidden="true">↗</b>
                </a>
              ))}
              {!results.length && <div className="platform-empty compact-empty"><span>⌕</span><h2>没有匹配公告</h2><p>试试“征集”“公安”或“招生计划”，也可以清空筛选。</p><button type="button" className="primary-action" onClick={resetSearch}>重置筛选</button></div>}
            </div>
            {pageCount > 1 && <nav className="notice-pagination" aria-label="公告分页"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>上一页</button><span aria-live="polite">第 {currentPage} / {pageCount} 页</span><button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button></nav>}
            <div className="notice-list-footnote">公告日期不等于填报截止日期。进入原文核对时间、报考条件与计划后再操作。</div>
          </div>

          <aside className="card notice-timeline-card">
            <div className="notice-section-heading"><div><span className="eyebrow">2026 · 已公布日程</span><h2>关键填报节点</h2></div><span className="notice-archive-tag">年度档案</span></div>
            <p className="notice-schedule-note">5 个已核对节点 · 北京时间<br />部分重要安排，最新补充以考试院公告为准。</p>
            <div className="notice-view-switch" aria-label="日程视图"><button type="button" aria-pressed={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}>事项时间线</button><button type="button" aria-pressed={view === "calendar"} className={view === "calendar" ? "active" : ""} onClick={() => setView("calendar")}>月历总览</button></div>

            {view === "calendar" && <div className="notice-calendar">
              <div className="notice-month-heading"><button type="button" onClick={() => changeMonth(-1)} aria-label="上个月">‹</button><strong>{month.slice(0, 4)} 年 {Number(month.slice(5, 7))} 月</strong><button type="button" onClick={() => changeMonth(1)} aria-label="下个月">›</button></div>
              <div className="notice-calendar-grid" role="group" aria-label={`${month} 日程`}>
                {weekdays.map((day) => <span className="notice-calendar-weekday" key={day}>{day}</span>)}
                {monthDays.map((day, index) => {
                  const count = day ? admissionCalendar.filter((event) => event.startsAt.slice(0, 10) <= day && event.endsAt.slice(0, 10) >= day).length : 0;
                  return day ? <button type="button" key={day} className={`${count ? "has-event" : ""} ${selectedDay === day ? "selected" : ""}`} aria-pressed={selectedDay === day} aria-label={`${day}，${count} 个日程`} onClick={() => setSelectedDay(selectedDay === day ? "" : day)}><span>{Number(day.slice(8))}</span>{count > 0 && <i />}</button> : <span className="notice-calendar-blank" key={`blank-${index}`} />;
                })}
              </div>
              <p className="notice-calendar-legend"><i /> 着色日期为已核对事项所在日；每天开放时段见原文。</p>
              {selectedDay && <button type="button" className="notice-calendar-clear" onClick={() => setSelectedDay("")}>已选 {selectedDay.slice(5)} · 显示整月 ×</button>}
            </div>}

            <div className="notice-events" aria-live="polite">{shownEvents.map((event) => <EventCard event={event} now={now} key={event.id} />)}{!shownEvents.length && <div className="notice-calendar-empty">这段时间没有已整理节点。未收录不代表官方没有安排，请核对最新公告。</div>}</div>
            <a className="secondary-link" href={OFFICIAL_GAOKAO_URL} target="_blank" rel="noreferrer">查看官方完整公告 ↗</a>
          </aside>
        </section>
      </div>
    </SiteShell>
  );
}
