"use client";

import Link from "next/link";
import { useState } from "react";
import { getOfficialEligibility, type OfficialSavedGroup } from "../../group-comparison";
import { usePlatform } from "../../platform-state";
import { DataNotice, EmptyState } from "../../platform-components";
import { ToolPageShell } from "../tool-shell";

function values(group: OfficialSavedGroup, field: "subjectRequirement" | "tuition" | "campus") {
  return [...new Set(group.offering.majors.map((major) => major[field] || "未公布"))].join("；");
}

function verification(group: OfficialSavedGroup) {
  return group.verification === "verified" ? "已与当前官方计划核对" : group.verification === "checking" ? "正在重新核对" : group.verification === "offline" ? "离线快照，尚未核对当前计划" : "当前目录未找到，请重新选择";
}

export default function CompareToolPage() {
  const { profile, profileConfigured, officialSavedGroups, hydrated } = usePlatform();
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const left = officialSavedGroups.find((item) => item.id === leftId) ?? officialSavedGroups[0];
  const right = officialSavedGroups.find((item) => item.id === rightId) ?? officialSavedGroups[1];
  const label = (group: OfficialSavedGroup) => `${group.schoolName} · ${group.offering.professionalGroup || "未标组号"} · ${group.offering.subject} · ${group.offering.batch} · ${group.offering.planCategory}`;
  function qualification(group: OfficialSavedGroup) {
    if (!profileConfigured) return "待完善考生档案";
    if (group.verification !== "verified") return verification(group);
    const check = getOfficialEligibility(group.offering, profile);
    return `${check.status === "eligible" ? "选科初筛通过" : check.status === "blocked" ? "选科不符" : "待核验"}：${check.reason}`;
  }
  const dimensions: [string, (group: OfficialSavedGroup) => string][] = [
    ["计划年份", (group) => `${group.year} 年`],
    ["院校与专业组代号", (group) => `${group.schoolCode} / ${group.offering.professionalGroup || "未标注"}`],
    ["批次与科类", (group) => `${group.offering.batch} · ${group.offering.subject}`],
    ["计划类别", (group) => group.offering.planCategory || "未标注"],
    ["组内专业与计划", (group) => group.offering.majors.map((major) => `${major.name}（${major.planCount} 人）`).join("；")],
    ["当年计划合计", (group) => `${group.offering.planCount} 人`],
    ["再选科目要求", (group) => values(group, "subjectRequirement")],
    ["当前档案初筛", qualification],
    ["学费（各专业原文）", (group) => values(group, "tuition")],
    ["办学地点", (group) => values(group, "campus")],
    ["外语与口试", (group) => [...new Set(group.offering.majors.map((major) => `${major.foreignLanguage || "外语要求未公布"}${major.oralExam === "是" ? " · 需要口试" : major.oralExam === "否" ? " · 不要求口试" : " · 口试待核验"}`))].join("；")],
    ["专业备注", (group) => [...new Set(group.offering.majors.map((major) => major.notes).filter(Boolean))].join("；") || "计划中未列备注，请继续核对招生章程"],
    ["数据核验", verification],
    ["计划快照日期", (group) => group.catalogGeneratedAt.slice(0, 10)],
    ["跨年专业组构成", () => "暂缺往年官方组内计划；同组号不代表同专业构成，暂不计算变化与录取风险。"],
  ];

  return <ToolPageShell eyebrow="GROUP COMPARISON" title="院校专业组 PK" description="从志愿表中选择两个真实专业组，逐项比较专业构成、计划、学费和报考条件。">
    <DataNotice label="官方计划对比" kind="official">对比只使用当年官方计划，且保留不同批次、科类和计划类别。选科初筛不等于完整报考资格，录取风险仍需结合可比的历史组与位次数据判断。</DataNotice>
    {!hydrated ? <div className="official-loading" role="status"><span /><p>正在恢复你的官方专业组…</p></div> : officialSavedGroups.length < 2 ? <EmptyState title="先加入两个官方专业组" description={`当前有 ${officialSavedGroups.length} 个官方专业组。到院校库打开招生计划，将想比较的专业组加入志愿表后再来。早期演示条目不参与对比。`} action={<Link className="primary-link" href="/schools">去院校库添加 →</Link>} /> : left && right && <section className="card compare-workbench">
      <div className="compare-selectors"><label><span>方案 A</span><select value={left.id} onChange={(event) => setLeftId(event.target.value)}>{officialSavedGroups.map((group) => <option value={group.id} key={group.id}>{label(group)}</option>)}</select></label><span>PK</span><label><span>方案 B</span><select value={right.id} onChange={(event) => setRightId(event.target.value)}>{officialSavedGroups.map((group) => <option value={group.id} key={group.id}>{label(group)}</option>)}</select></label></div>
      {left.id === right.id ? <div className="platform-empty compact-empty"><span>PK</span><h2>请选择两个不同的专业组</h2><p>更换任意一侧，即可查看比较表。</p></div> : <>
        {(left.offering.batch !== right.offering.batch || left.offering.subject !== right.offering.subject || left.offering.planCategory !== right.offering.planCategory) && <p className="comparison-missing">两组的批次、科类或计划类别不同。可以比较培养与费用条件，但不能按同一录取门槛排序。</p>}
        <div className="compare-head"><span>比较维度</span><div><strong>{left.schoolName}</strong><small>{left.year} · 专业组 {left.offering.professionalGroup || "未标注"}</small></div><div><strong>{right.schoolName}</strong><small>{right.year} · 专业组 {right.offering.professionalGroup || "未标注"}</small></div></div>
        <div className="compare-table">{dimensions.map(([name, render]) => <div className="compare-row" key={name}><strong>{name}</strong><span>{render(left)}</span><span>{render(right)}</span></div>)}<div className="compare-row"><strong>官方来源</strong>{[left, right].map((group) => <span key={group.id}><a href={group.sourceUrl} target="_blank" rel="noreferrer">考试院招生计划 ↗</a></span>)}</div></div>
        <div className="compare-actions">{[left, right].map((group) => <div key={group.id}><Link className="secondary-link" href={`/schools/detail?school=${encodeURIComponent(group.schoolId)}&group=${encodeURIComponent(group.offering.id)}`}>查看该组完整计划</Link><Link className="primary-link" href="/volunteer-list">调整志愿顺序 →</Link></div>)}</div>
      </>}
    </section>}
  </ToolPageShell>;
}
