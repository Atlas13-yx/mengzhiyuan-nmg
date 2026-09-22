"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  admissionsAsset,
  formatNumber,
  type AdmissionsCatalog,
  type AdmissionsCatalogMeta,
  type AdmissionsCorrection,
  type AdmissionsOffering,
  type AdmissionsSchoolDetail,
  type AdmissionsSchoolSummary,
} from "../../admissions-data";
import { Breadcrumbs, DataNotice, SiteShell } from "../../platform-components";
import { compareGroupComposition, createOfficialSelection, getHistoricalCandidates, getOfficialEligibility } from "../../group-comparison";
import { usePlatform } from "../../platform-state";
import { schoolGroups } from "../../platform-data";

function CorrectionCard({ correction }: { correction: AdmissionsCorrection }) {
  return (
    <article className="official-correction-card">
      <div><span>{correction.publishedAt}</span><a href={correction.url} target="_blank" rel="noreferrer">考试院原文 ↗</a></div>
      <h3>{correction.title}</h3>
      {correction.appliedChanges?.length ? (
        <ul>{correction.appliedChanges.map((change, index) => <li key={`${change.field}-${index}`}><strong>{change.majorName || change.schoolName}</strong>：{change.note}（{String(change.before || "无")} → {String(change.after)}）</li>)}</ul>
      ) : <p>{correction.content.slice(0, 260) || "该公告以图片形式发布，请打开考试院原文核对。"}</p>}
      {correction.embeddedImages.map((image) => <a className="correction-image-link" href={admissionsAsset(image.file)} target="_blank" rel="noreferrer" key={image.file}>查看官方表格图片</a>)}
    </article>
  );
}

function OfferingCard({ offering, school, detail, meta }: { offering: AdmissionsOffering; school: AdmissionsSchoolSummary; detail: AdmissionsSchoolDetail; meta: AdmissionsCatalogMeta }) {
  const { profile, profileConfigured, isSaved, toggleOfficialSaved, hydrated } = usePlatform();
  const selection = createOfficialSelection(school, detail, offering, meta);
  const saved = isSaved(selection.id);
  const eligibility = profileConfigured ? getOfficialEligibility(offering, profile) : { status: "review", reason: "完善考生档案后，自动核对选科要求。" };
  const historicalCandidates = getHistoricalCandidates(detail, offering);
  const comparison = compareGroupComposition(offering, null);
  return (
    <article className="official-offering-card" id={`group-${offering.id}`}>
      <header>
        <div><span>{offering.batch} · {offering.subject}</span><h3>专业组 {offering.professionalGroup || "—"}</h3></div>
        <div><strong>{offering.planCount}</strong><span>计划数</span></div>
      </header>
      <p className="offering-category">{offering.planCategory || "计划类别未标注"} · {offering.majors.length} 个专业计划</p>
      <div className="offering-actions">
        <p className={eligibility.status === "blocked" ? "blocked-text" : "section-explainer"}>{eligibility.status === "eligible" ? "✓ " : ""}{eligibility.reason}</p>
        <button type="button" className={saved ? "secondary-link" : "primary-link"} disabled={!hydrated} aria-pressed={saved} onClick={() => toggleOfficialSaved(selection)}>{!hydrated ? "正在恢复…" : saved ? "已加入志愿表 ✓" : "加入志愿表"}</button>
        {saved && <Link className="secondary-link" href="/volunteer-list">查看方案 →</Link>}
      </div>
      <div className="official-major-table-wrap">
        <table className="official-major-table">
          <thead><tr><th>专业</th><th>计划</th><th>学制</th><th>学费</th><th>选科</th><th>办学地点 / 备注</th></tr></thead>
          <tbody>{offering.majors.map((major) => <tr key={`${major.code}-${major.name}`}>
            <td><b>{major.code}</b><strong>{major.name}</strong>{major.includedMajors && <small>包含：{major.includedMajors}</small>}{major.adjustments.length > 0 && <em>已合并官方刊误</em>}</td>
            <td>{major.planCount}</td>
            <td>{major.durationYears ? `${major.durationYears}年` : "—"}</td>
            <td>{major.tuition ? (/^\d+$/.test(major.tuition) ? `${Number(major.tuition).toLocaleString("zh-CN")}元/年` : major.tuition) : "—"}</td>
            <td>{major.subjectRequirement || "—"}</td>
            <td><span>{major.campus || "—"}</span>{major.notes && <small>{major.notes}</small>}{major.foreignLanguage && major.foreignLanguage !== "不限" && <small>外语：{major.foreignLanguage}</small>}{major.oralExam === "是" && <small>需要口试</small>}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <details className="group-comparison-panel">
        <summary>跨年专业组核对 <span>{historicalCandidates.length ? `${historicalCandidates.length} 条同口径同组号候选分数` : "暂无同口径同组号分数"}</span></summary>
        <div className="group-comparison-meta">
          <div><small>{meta.year} 年组内构成</small><strong>{offering.majors.length} 个专业计划 · {offering.planCount} 人</strong><p>{offering.majors.map((major) => major.name).join("、")}</p><a href={detail.sources.planIndex} target="_blank" rel="noreferrer">查看当年官方招生计划 ↗</a></div>
          <div><small>{meta.scoreYear} 年组内构成</small><strong>暂缺官方专业计划</strong><p>专业新增 / 移出：待核验<br />选科、学费、校区变更：待核验<br />计划增减：待核验</p></div>
        </div>
        <p className="comparison-missing">{comparison.reason}下列候选仅同时满足院校、批次、科类、计划类别与组号相同，仍不能认定两年是同一招生组合。</p>
        {historicalCandidates.length > 0 ? <div className="official-score-table-wrap"><table className="official-score-table"><thead><tr><th>历史年份 / 类型</th><th>填报轮次</th><th>最低分</th><th>最高分</th><th>来源</th></tr></thead><tbody>{historicalCandidates.map((score, index) => <tr key={`${score.sourceUrl}-${index}`}><td>{score.year} · {score.kind}</td><td>{score.roundTitle.replace(/^2025年普通高考/, "")}</td><td>{formatNumber(score.minimumScore)}</td><td>{formatNumber(score.maximumScore)}</td><td><a href={score.sourceUrl} target="_blank" rel="noreferrer">考试院 ↗</a></td></tr>)}</tbody></table></div> : <p className="section-explainer">未用其他批次、科类或相近组号补位。可以继续查看下方该院校的全部官方历史分数。</p>}
      </details>
    </article>
  );
}

export default function SchoolDetailPage() {
  const [summary, setSummary] = useState<AdmissionsSchoolSummary | null>(null);
  const [detail, setDetail] = useState<AdmissionsSchoolDetail | null>(null);
  const [catalogMeta, setCatalogMeta] = useState<AdmissionsCatalogMeta | null>(null);
  const [focusedGroupId, setFocusedGroupId] = useState("");
  const [legacyLink, setLegacyLink] = useState(false);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState("全部批次");
  const [subject, setSubject] = useState("全部科类");
  const [query, setQuery] = useState("");
  const [visibleOfferings, setVisibleOfferings] = useState(12);
  const [scoreKind, setScoreKind] = useState("全部分数");
  const [visibleScores, setVisibleScores] = useState(40);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      const parameters = new URLSearchParams(window.location.search);
      const schoolId = parameters.get("school");
      if (!schoolId) throw new Error("missing-school");
      const catalogResponse = await fetch(admissionsAsset("/data/admissions-2026/catalog.json"), { signal: controller.signal });
      if (!catalogResponse.ok) throw new Error(`catalog HTTP ${catalogResponse.status}`);
      const catalog = await catalogResponse.json() as AdmissionsCatalog;
      const demoSchool = schoolGroups.find((item) => item.id === schoolId)?.school;
      const school = catalog.schools.find((item) => item.id === schoolId) ?? (demoSchool ? catalog.schools.find((item) => item.name === demoSchool) : undefined);
      if (!school) throw new Error("school-not-found");
      setCatalogMeta(catalog.meta);
      setLegacyLink(school.id !== schoolId);
      setSummary(school);
      const detailResponse = await fetch(admissionsAsset(school.detailFile), { signal: controller.signal });
      if (!detailResponse.ok) throw new Error(`detail HTTP ${detailResponse.status}`);
      const shard = await detailResponse.json() as Record<string, AdmissionsSchoolDetail>;
      if (!shard[school.id]) throw new Error("detail-not-found");
      const requestedGroup = parameters.get("group");
      if (requestedGroup && !shard[school.id].offerings.some((offering) => offering.id === requestedGroup)) throw new Error("group-not-found");
      setFocusedGroupId(requestedGroup || "");
      setDetail(shard[school.id]);
    }
    load().catch((reason) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error && reason.message === "missing-school" ? "缺少院校参数，请返回院校库重新选择。" : reason instanceof Error && reason.message === "school-not-found" ? "没有找到该院校，请返回院校库重新选择。" : reason instanceof Error && reason.message === "group-not-found" ? "该专业组不在当前计划中，可能已调整，请从院校库重新核对。" : "院校详情暂时无法载入，请刷新后重试。");
    });
    return () => controller.abort();
  }, []);

  const offerings = useMemo(() => {
    if (!detail) return [];
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    return detail.offerings.filter((offering) => {
      if (focusedGroupId && offering.id !== focusedGroupId) return false;
      if (batch !== "全部批次" && offering.batch !== batch) return false;
      if (subject !== "全部科类" && offering.subject !== subject) return false;
      if (!keyword) return true;
      return `${offering.professionalGroup} ${offering.majors.map((major) => `${major.code} ${major.name} ${major.includedMajors}`).join(" ")}`.toLocaleLowerCase("zh-CN").includes(keyword);
    });
  }, [batch, detail, focusedGroupId, query, subject]);

  const scores = useMemo(() => {
    if (!detail) return [];
    return detail.scoreHistory.filter((score) => scoreKind === "全部分数" || score.kind === scoreKind);
  }, [detail, scoreKind]);

  return (
    <SiteShell active="/schools">
      <div className="platform-page detail-page official-detail-page">
        <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "院校专业组库", href: "/schools" }, { label: detail?.name || summary?.name || "院校详情" }]} />
        {error && <div className="platform-empty"><span>!</span><h2>无法打开院校详情</h2><p>{error}</p><Link className="primary-link" href="/schools">返回院校库</Link></div>}
        {!detail && !error && <div className="official-loading"><span /><p>正在读取该院校全部专业计划与历史分数…</p></div>}
        {detail && summary && catalogMeta && <>
          <section className="official-detail-hero">
            <div><span>2026 官方院校代号 {detail.code}</span><h1>{detail.name}</h1><p>{summary.batches.join(" · ")}</p></div>
            <div className="official-detail-actions"><a href={detail.sources.planIndex} target="_blank" rel="noreferrer">考试院计划原文</a>{detail.officialCharterUrl && <a href={detail.officialCharterUrl} target="_blank" rel="noreferrer">招生章程</a>}</div>
          </section>
          <section className="official-stats detail-stats">
            <div><strong>{formatNumber(summary.planCount)}</strong><span>2026计划数</span></div>
            <div><strong>{formatNumber(summary.majorCount)}</strong><span>专业计划行</span></div>
            <div><strong>{formatNumber(summary.groupCount)}</strong><span>专业组/招生单元</span></div>
            <div><strong>{formatNumber(summary.scoreRecordCount)}</strong><span>2025分数记录</span></div>
            <div><strong>{summary.correctionCount}</strong><span>已合并刊误</span></div>
          </section>
          <DataNotice label="官方数据快照" kind="official">计划字段和2025历史分数均来自内蒙古自治区教育考试院；历史分数按“{summary.scoreMatch || "未匹配"}”关联。不同批次、科类和艺术体育综合分不可直接横向比较。</DataNotice>
          {legacyLink && <p className="section-explainer">你打开的是早期示例链接。这里已切换到该校官方计划，请重新选择具体专业组；示例组与真实专业组不自动对应。</p>}
          <p className="section-explainer">计划快照：{new Date(catalogMeta.generatedAt).toLocaleDateString("zh-CN")} · 专业组构成以 {catalogMeta.year} 年计划为准。往年分数为回顾资料，不构成当年录取保证。</p>

          <section className="official-detail-section">
            <div className="section-title"><div><span className="eyebrow">2026 ADMISSIONS PLAN</span><h2>全部招生专业</h2></div><span>{offerings.length} 个专业组/招生单元</span></div>
            {focusedGroupId && <div className="offering-actions"><p>正在查看你从志愿表选中的专业组。</p><button className="secondary-link" type="button" onClick={() => { setFocusedGroupId(""); setBatch("全部批次"); setSubject("全部科类"); setQuery(""); }}>查看该院校全部专业组</button></div>}
            <div className="card official-detail-filter">
              <label><span>搜索专业</span><input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleOfferings(12); }} placeholder="专业名、专业代号或专业组" /></label>
              <label><span>批次</span><select value={batch} onChange={(event) => { setBatch(event.target.value); setVisibleOfferings(12); }}><option>全部批次</option>{summary.batches.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>科类</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setVisibleOfferings(12); }}><option>全部科类</option>{summary.subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <div className="official-offering-list">{offerings.slice(0, visibleOfferings).map((offering) => <OfferingCard offering={offering} school={summary} detail={detail} meta={catalogMeta} key={offering.id} />)}</div>
            {offerings.length === 0 && <div className="platform-empty"><span>⌕</span><h2>没有匹配的专业</h2><p>请更换搜索词或筛选条件。</p></div>}
            {visibleOfferings < offerings.length && <button className="official-load-more" type="button" onClick={() => setVisibleOfferings((count) => count + 12)}>继续加载专业组（还有 {offerings.length - visibleOfferings} 个）</button>}
          </section>

          <section className="official-detail-section score-history-section">
            <div className="section-title"><div><span className="eyebrow">2025 OFFICIAL SCORES</span><h2>官方投档与录取分数</h2></div><select aria-label="分数类型" value={scoreKind} onChange={(event) => { setScoreKind(event.target.value); setVisibleScores(40); }}><option>全部分数</option><option>投档</option><option>录取</option></select></div>
            <p className="section-explainer">2025年为内蒙古3+1+2新高考首年。这里保留每次填报轮次，不用后续征集分数覆盖第一次投档分数。</p>
            {scores.length ? <div className="official-score-table-wrap"><table className="official-score-table"><thead><tr><th>类型 / 轮次</th><th>批次</th><th>科类</th><th>专业组</th><th>人数</th><th>最低分</th><th>最高分</th><th>来源</th></tr></thead><tbody>{scores.slice(0, visibleScores).map((score, index) => <tr key={`${score.sourceUrl}-${score.professionalGroup}-${index}`}><td><b>{score.kind}</b><small>{score.roundTitle.replace(/^2025年普通高考/, "")}</small></td><td>{score.batch || "—"}</td><td>{score.subject || "—"}</td><td>{score.professionalGroup || "—"}</td><td>{formatNumber(score.count)}</td><td><strong>{formatNumber(score.minimumScore)}</strong></td><td>{formatNumber(score.maximumScore)}</td><td><a href={score.sourceUrl} target="_blank" rel="noreferrer">考试院 ↗</a></td></tr>)}</tbody></table></div> : <div className="platform-empty"><span>分</span><h2>暂无可安全匹配的2025官方分数</h2><p>院校代码或名称发生变化时，系统不会猜测关联。</p></div>}
            {visibleScores < scores.length && <button className="official-load-more" type="button" onClick={() => setVisibleScores((count) => count + 40)}>继续加载分数记录（还有 {scores.length - visibleScores} 条）</button>}
          </section>

          {detail.corrections.length > 0 && <section className="official-detail-section correction-section"><div className="section-title"><div><span className="eyebrow">OFFICIAL CORRECTIONS</span><h2>刊误与增补合并记录</h2></div><a href={detail.sources.correctionIndex} target="_blank" rel="noreferrer">全部公告 →</a></div><div className="official-correction-list">{detail.corrections.map((correction) => <CorrectionCard correction={correction} key={correction.url} />)}</div></section>}
        </>}
      </div>
    </SiteShell>
  );
}
