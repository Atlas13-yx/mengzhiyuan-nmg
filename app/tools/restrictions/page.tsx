"use client";

import Link from "next/link";
import { useState } from "react";
import { getOfficialEligibility } from "../../group-comparison";
import { usePlatform, validateSubjectCombination } from "../../platform-state";
import { DataNotice } from "../../platform-components";
import { ToolPageShell } from "../tool-shell";

const checks = [
  { id: "health", title: "已核对本人的体检结论与目标专业要求", detail: "逐项检查色觉、视力、听力等条件，不能只凭专业名称判断。" },
  { id: "language", title: "已核对外语语种、口试与单科成绩", detail: "按组内每个意向专业的计划备注及招生章程核对。" },
  { id: "special", title: "已核对专项、军校、公安等资格材料", detail: "有特殊要求的专业需另查考核、面试、体检、体能及资格名单；普通类也应核对是否存在附加条件。" },
  { id: "charter", title: "已阅读当年章程与最新刊误公告", detail: "重点检查培养地点、学费、调剂范围和新增限制。" },
] as const;

export default function RestrictionsToolPage() {
  const { profile, profileConfigured, officialSavedGroups, savedGroups, hydrated } = usePlatform();
  const contextKey = JSON.stringify([profile, officialSavedGroups.map((group) => [group.id, group.catalogGeneratedAt])]);
  const [confirmation, setConfirmation] = useState<{ context: string; values: Record<string, boolean> }>({ context: "", values: {} });
  const confirmed = confirmation.context === contextKey ? confirmation.values : {};
  const combination = validateSubjectCombination(profile);
  const ready = hydrated && profileConfigured && combination.valid;
  const results = officialSavedGroups.map((group) => ({ group, check: !ready ? { status: "review", reason: "先保存有效的考生选科档案。" } : group.verification !== "verified" ? { status: "review", reason: group.verification === "unavailable" ? "当前官方目录未找到此组，需要重新选择。" : "当前计划尚未核验，请联网后重新打开。" } : getOfficialEligibility(group.offering, profile) }));
  const blocked = results.filter((item) => item.check.status === "blocked");
  const review = results.filter((item) => item.check.status === "review");
  const passed = results.filter((item) => item.check.status === "eligible");
  const manualRemaining = checks.filter((item) => !confirmed[item.id]).length;
  const complete = ready && officialSavedGroups.length > 0 && !blocked.length && !review.length && !manualRemaining;
  const status = !hydrated ? "恢复中" : !profileConfigured ? "未建立档案" : !combination.valid ? "档案需修正" : !officialSavedGroups.length ? "尚未加入官方组" : blocked.length ? `${blocked.length} 组选科不符` : review.length ? `${review.length} 组待核验` : "选科初筛通过";
  const resultReason = !profileConfigured ? "请先保存本人档案；预填示例不会被用于资格认证。" : !combination.valid ? combination.reason : !officialSavedGroups.length ? "志愿表没有官方专业组，尚无可核验的招生条件。" : blocked.length ? `${blocked.length} 个专业组存在选科冲突，请重新选择或修正档案。` : review.length ? `${review.length} 个专业组仍需核验数据或特殊资格；勾选人工确认不会自动认定资格通过。` : manualRemaining ? `还有 ${manualRemaining} 项人工核对未记录。` : "本次基础自查已记录；体检、特殊资格与最终可报结论仍由考试院及高校核定。";

  return <ToolPageShell eyebrow="RESTRICTION CHECK" title="限报风险自查" description="先按真实专业组计划核对选科，再逐项检查体检、外语和特殊招生资格。修改档案或备选组后，人工记录会重新置为待核对。">
    <DataNotice label="资格辅助自查" kind="reference">系统只能识别计划中明确列出的选科条件。提前批、专项及艺术体育等特殊类别始终保留资格待核验提示，个人勾选不能替代官方审核。</DataNotice>
    <section className="restriction-grid">
      <div className="card auto-check-card">
        <div className="section-title"><div><span className="eyebrow">自动检查</span><h2>档案与志愿表资格</h2></div><span className={ready && officialSavedGroups.length && !blocked.length && !review.length ? "status-ok" : "status-warning"}>{status}</span></div>
        <div className="auto-check-list">
          <div className={ready ? "passed" : "failed"}><span>{ready ? "✓" : "!"}</span><div><strong>已确认的 3+1+2 选科档案</strong><p>{!profileConfigured ? "尚未保存本人的选科。请先完善档案，再进行自动初筛。" : combination.reason}</p>{!ready && <Link href="/profile">完善考生档案 →</Link>}</div></div>
          <div className={ready && officialSavedGroups.length && !blocked.length && !review.length ? "passed" : "failed"}><span>{ready && officialSavedGroups.length && !blocked.length && !review.length ? "✓" : "!"}</span><div><strong>真实专业组逐项检查</strong><p>{officialSavedGroups.length ? `${officialSavedGroups.length} 个官方组：${passed.length} 组初筛通过，${blocked.length} 组选科不符，${review.length} 组待核验。` : "暂无官方专业组；空表不代表资格检查通过。"}</p>{savedGroups.length > 0 && <p>{savedGroups.length} 个早期演示条目不参与资格判断。</p>}<Link href={officialSavedGroups.length ? "/volunteer-list" : "/schools"}>{officialSavedGroups.length ? "调整志愿表" : "添加官方专业组"} →</Link></div></div>
          {results.map(({ group, check }) => <div className={check.status === "eligible" ? "passed" : "failed"} key={group.id}><span>{check.status === "eligible" ? "✓" : "!"}</span><div><strong>{group.schoolName} · {group.offering.professionalGroup || "未标组号"}</strong><p>{group.offering.batch} · {group.offering.subject} · {group.offering.planCategory}</p><p>{check.reason}</p><Link href={`/schools/detail?school=${encodeURIComponent(group.schoolId)}&group=${encodeURIComponent(group.offering.id)}`}>核对计划与章程 →</Link></div></div>)}
        </div>
      </div>
      <div className="card manual-check-card">
        <div className="section-title"><div><span className="eyebrow">人工记录</span><h2>逐项核对后再确认</h2></div><span>{checks.length - manualRemaining}/{checks.length}</span></div>
        <div className="manual-check-list">{checks.map((item) => <label key={item.id}><input type="checkbox" disabled={!ready || !officialSavedGroups.length} checked={Boolean(confirmed[item.id])} onChange={(event) => setConfirmation({ context: contextKey, values: { ...confirmed, [item.id]: event.target.checked } })} /><span><strong>{item.title}</strong><small>{item.detail}</small></span></label>)}</div>
        {(!ready || !officialSavedGroups.length) && <p className="section-explainer">保存本人档案并加入官方专业组后，再记录这些核对结果。</p>}
        <div className="manual-actions"><button type="button" onClick={() => setConfirmation({ context: contextKey, values: {} })}>重置人工记录</button></div>
      </div>
    </section>
    <section className={complete ? "restriction-result complete" : "restriction-result pending"} aria-live="polite"><span>{complete ? "✓" : "!"}</span><div><strong>{complete ? "基础自查已记录" : "风险检查尚未完成"}</strong><p>{resultReason}</p></div><Link href={!ready ? "/profile" : !officialSavedGroups.length ? "/schools" : "/volunteer-list"}>{!ready ? "完善档案" : !officialSavedGroups.length ? "添加专业组" : "查看志愿表"} →</Link></section>
  </ToolPageShell>;
}
