"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  admissionsAsset,
  formatNumber,
  type AdmissionsCatalog,
  type AdmissionsSchoolSummary,
} from "../admissions-data";
import { DataNotice, PageIntro, SiteShell } from "../platform-components";

const PAGE_SIZE = 30;

function SchoolCard({ school }: { school: AdmissionsSchoolSummary }) {
  return (
    <article className="official-school-card">
      <div className="official-school-head">
        <div>
          <span className="official-code">院校代号 {school.code}</span>
          <Link href={`/schools/detail?school=${encodeURIComponent(school.id)}`}>{school.name}</Link>
        </div>
        {school.correctionCount > 0 && <b className="correction-flag">{school.correctionCount} 条刊误已合并</b>}
      </div>
      <div className="official-school-tags">
        {school.batches.slice(0, 3).map((batch) => <span key={batch}>{batch}</span>)}
        {school.batches.length > 3 && <span>+{school.batches.length - 3} 批次</span>}
      </div>
      <div className="official-school-metrics">
        <div><strong>{formatNumber(school.planCount)}</strong><span>2026 计划数</span></div>
        <div><strong>{formatNumber(school.majorCount)}</strong><span>专业计划行</span></div>
        <div><strong>{formatNumber(school.groupCount)}</strong><span>专业组/招生单元</span></div>
        <div><strong>{formatNumber(school.scoreRecordCount)}</strong><span>2025 分数记录</span></div>
      </div>
      <p className="official-subjects">{school.subjects.slice(0, 5).join(" · ")}{school.subjects.length > 5 ? ` · 等 ${school.subjects.length} 类` : ""}</p>
      <div className="official-card-footer">
        <span>{school.scoreRecordCount ? `已按${school.scoreMatch}匹配历史分数` : "暂无可安全匹配的2025官方分数"}</span>
        <Link href={`/schools/detail?school=${encodeURIComponent(school.id)}`}>查看全部专业与分数 →</Link>
      </div>
    </article>
  );
}

export default function SchoolsPage() {
  const [catalog, setCatalog] = useState<AdmissionsCatalog | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("全部批次");
  const [subject, setSubject] = useState("全部科类");
  const [planCategory, setPlanCategory] = useState("全部计划类别");
  const [scoreOnly, setScoreOnly] = useState(false);
  const [sort, setSort] = useState("计划数从高到低");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") ?? "");
    setSubject(params.get("subject") ?? "全部科类");
    setBatch(params.get("batch") ?? "全部批次");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch(admissionsAsset("/data/admissions-2026/catalog.json"), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<AdmissionsCatalog>;
      })
      .then(setCatalog)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("院校库数据暂时无法载入，请刷新后重试。");
      });
    return () => controller.abort();
  }, [retry]);

  const results = useMemo(() => {
    if (!catalog) return [];
    const keyword = query.trim().toLocaleLowerCase("zh-CN");
    const filtered = catalog.schools.filter((school) => {
      if (keyword && !`${school.name} ${school.code}`.toLocaleLowerCase("zh-CN").includes(keyword)) return false;
      if (batch !== "全部批次" && !school.batches.includes(batch)) return false;
      if (subject !== "全部科类" && !school.subjects.includes(subject)) return false;
      if (planCategory !== "全部计划类别" && !school.planCategories.includes(planCategory)) return false;
      if (scoreOnly && school.scoreRecordCount === 0) return false;
      return true;
    });
    return filtered.sort((left, right) => {
      if (sort === "专业数从高到低") return right.majorCount - left.majorCount || left.name.localeCompare(right.name, "zh-CN");
      if (sort === "院校名称") return left.name.localeCompare(right.name, "zh-CN");
      if (sort === "历史分数记录优先") return right.scoreRecordCount - left.scoreRecordCount || right.planCount - left.planCount;
      return right.planCount - left.planCount || left.name.localeCompare(right.name, "zh-CN");
    });
  }, [batch, catalog, planCategory, query, scoreOnly, sort, subject]);

  function resetFilters() {
    setVisibleCount(PAGE_SIZE);
    setQuery("");
    setBatch("全部批次");
    setSubject("全部科类");
    setPlanCategory("全部计划类别");
    setScoreOnly(false);
    setSort("计划数从高到低");
  }

  return (
    <SiteShell active="/schools">
      <div className="platform-page schools-page official-library-page">
        <PageIntro
          eyebrow="OFFICIAL ADMISSIONS CATALOG"
          title="院校专业组库"
          description="查询已收录的 2026 招生计划与 2025 投档、录取分数。选择院校后，按批次、科类和专业组查看组内专业、学费与限制条件。"
          actions={<a className="primary-link" href="https://www.nm.zsks.cn/26gkwb/26zsjh/" target="_blank" rel="noreferrer">核对考试院原文 →</a>}
        />

        {catalog && (
          <section className="official-stats" aria-label="官方数据总览">
            <div><strong>{formatNumber(catalog.meta.schoolCount)}</strong><span>院校招生单元</span></div>
            <div><strong>{formatNumber(catalog.meta.majorRowCount)}</strong><span>专业计划行</span></div>
            <div><strong>{formatNumber(catalog.meta.totalPlanCount)}</strong><span>刊误合并后计划数</span></div>
            <div><strong>{formatNumber(catalog.meta.scoreRecordCount)}</strong><span>2025官方分数记录</span></div>
            <div><strong>{catalog.meta.correctionCount}</strong><span>刊误/增补公告</span></div>
          </section>
        )}

        <DataNotice label="官方数据快照" kind="official">
          {catalog ? `已收录 ${catalog.meta.correctionCount} 条刊误/增补。` : "计划与历史分数保留考试院原文。"}院校级历史记录关联不代表跨年专业组等价；需在详情中核对同批次、科类与专业构成。
        </DataNotice>

        <section className="card official-filter-panel">
          <label className="search-field"><span aria-hidden="true">⌕</span><input aria-label="搜索院校名称或院校代号" value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }} placeholder="搜索院校名称或院校代号" /></label>
          <div className="filter-selects">
            <label><span>批次</span><select value={batch} onChange={(event) => { setBatch(event.target.value); setVisibleCount(PAGE_SIZE); }}><option>全部批次</option>{catalog?.filters.batches.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>科类</span><select value={subject} onChange={(event) => { setSubject(event.target.value); setVisibleCount(PAGE_SIZE); }}><option>全部科类</option>{catalog?.filters.subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>计划类别</span><select value={planCategory} onChange={(event) => { setPlanCategory(event.target.value); setVisibleCount(PAGE_SIZE); }}><option>全部计划类别</option>{catalog?.filters.planCategories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>排序</span><select value={sort} onChange={(event) => { setSort(event.target.value); setVisibleCount(PAGE_SIZE); }}><option>计划数从高到低</option><option>专业数从高到低</option><option>历史分数记录优先</option><option>院校名称</option></select></label>
            <label className="official-check"><input type="checkbox" checked={scoreOnly} onChange={(event) => { setScoreOnly(event.target.checked); setVisibleCount(PAGE_SIZE); }} /><span>仅看有历史分数</span></label>
            <button type="button" onClick={resetFilters}>重置</button>
          </div>
        </section>

        <section className="school-results-section">
          <div className="section-title"><div><span className="eyebrow">检索结果</span><h2>{catalog ? `${results.length.toLocaleString("zh-CN")} 所院校招生单元` : "正在载入完整院校库…"}</h2></div>{catalog && <span className="result-count-note">数据同步于 {new Date(catalog.meta.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</span>}</div>
          {error && <div className="platform-empty" role="alert"><span>!</span><h2>数据载入失败</h2><p>{error}</p><button type="button" className="primary-action" onClick={() => setRetry((value) => value + 1)}>重新载入</button></div>}
          {!catalog && !error && <div className="official-loading"><span /><p>正在读取考试院完整招生计划与历史分数…</p></div>}
          {catalog && results.length > 0 && <div className="official-school-grid">{results.slice(0, visibleCount).map((school) => <SchoolCard school={school} key={school.id} />)}</div>}
          {catalog && results.length === 0 && <div className="platform-empty"><span>⌕</span><h2>没有匹配结果</h2><p>请减少筛选条件或更换院校名称、代号。</p><button className="primary-action" type="button" onClick={resetFilters}>清除全部筛选</button></div>}
          {visibleCount < results.length && <button className="official-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>继续加载（还有 {(results.length - visibleCount).toLocaleString("zh-CN")} 所）</button>}
        </section>
      </div>
    </SiteShell>
  );
}
