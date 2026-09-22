"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlatform } from "../../platform-state";
import { DataNotice } from "../../platform-components";
import { ToolPageShell } from "../tool-shell";

export default function PlanChangeToolPage() {
  const { officialSavedGroups, hydrated } = usePlatform();
  const [batch, setBatch] = useState("");
  const batches = [...new Set(officialSavedGroups.map((group) => group.offering.batch))];
  const groups = useMemo(() => officialSavedGroups.filter((group) => !batch || group.offering.batch === batch), [officialSavedGroups, batch]);
  return (
    <ToolPageShell eyebrow="ADMISSIONS PLAN REVIEW" title="招生计划与变化核对" description="先汇总已选专业组的官方计划，再核对历年组内专业是否一致。历史组构成尚未完整接入，暂不计算扩招、缩招或持平。">
      <DataNotice kind="reference" label="跨年口径待核验">2025 年已接入的历史分数记录不能替代当年招生计划。比较计划变化需要核对年份、科类、批次、计划类别及组内专业，不能只凭相同组号相减。</DataNotice>
      <section className="card plan-workbench">
        <div className="tool-filter-bar">
          <label><span>已选专业组批次</span><select value={batch} onChange={(event) => setBatch(event.target.value)}><option value="">全部已选批次</option>{batches.map((item) => <option key={item}>{item}</option>)}</select></label>
          <Link className="secondary-link" href="/schools">去官方院校库添加专业组 →</Link>
          <Link className="secondary-link" href="/volunteer-list">管理志愿表 →</Link>
        </div>
        {!hydrated ? <p className="field-help" role="status">正在恢复已选专业组…</p> : groups.length ? (
          <div className="plan-table">
            <div className="plan-row plan-head"><span>已选官方专业组</span><span>当年计划</span><span>上年同口径</span><span>变化判断</span><span>核对依据</span></div>
            {groups.map((group) => <div className="plan-row" key={group.id}>
              <span><Link href={`/schools/detail?school=${encodeURIComponent(group.schoolId)}`}>{group.schoolName}</Link><small>{group.year} · 组 {group.offering.professionalGroup || "未标注"} · {group.offering.subject}<br />{group.offering.batch}</small></span>
              <strong>{group.verification === "verified" ? group.offering.planCount : "待核验"}</strong>
              <span>未接入</span>
              <span>暂不判断</span>
              <Link href={`/schools/detail?school=${encodeURIComponent(group.schoolId)}`}>核对计划 →</Link>
            </div>)}
          </div>
        ) : <div className="platform-empty"><span>计</span><h2>{officialSavedGroups.length ? "这个批次暂无已选专业组" : "先选入你关注的真实专业组"}</h2><p>从官方院校详情加入志愿表后，这里会展示对应计划数和跨年对比缺口。</p><Link className="primary-link" href="/schools">查看官方招生计划</Link></div>}
        {groups.some((group) => group.verification !== "verified") && <p className="field-help">部分收藏正在重新核验或暂时无法连接数据；未确认当前官方记录前，不展示其缓存计划数。</p>}
      </section>
      <div className="tool-official-note"><span>正式比较前，请逐项核对两年的专业名单、专业计划数和招生条件，拆组、合组或专业调入调出都会改变口径。</span><a href="https://www.nm.zsks.cn/26gkwb/26zsjh/" target="_blank" rel="noreferrer">2026 官方计划 ↗</a></div>
    </ToolPageShell>
  );
}

