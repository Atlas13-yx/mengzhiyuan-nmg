"use client";

import Link from "next/link";
import { useMemo } from "react";
import { csvCell, getOfficialEligibility, type OfficialSavedGroup } from "../group-comparison";
import { usePlatform } from "../platform-state";
import { OFFICIAL_GAOKAO_URL } from "../platform-data";
import { DataNotice, EmptyState, PageIntro, ProfileSnapshot, SiteShell } from "../platform-components";

const verificationLabels: Record<OfficialSavedGroup["verification"], string> = {
  checking: "正在核对当前计划",
  verified: "已与当前计划核对",
  offline: "暂时离线，显示已存快照",
  unavailable: "当年目录中未找到，请重新选择",
};

export default function VolunteerListPage() {
  const { profile, profileConfigured, savedIds, savedGroups, officialSavedGroups, moveSaved, removeSaved, sortSaved, clearSaved, hydrated, storageAvailable } = usePlatform();
  const checks = useMemo(() => new Map(officialSavedGroups.map((group) => [group.id,
    !profileConfigured ? { status: "review" as const, reason: "尚未保存考生档案，请先确认选科。" }
      : group.verification !== "verified" ? { status: "review" as const, reason: verificationLabels[group.verification] }
        : getOfficialEligibility(group.offering, profile),
  ])), [officialSavedGroups, profile, profileConfigured]);
  const count = (status: string) => [...checks.values()].filter((item) => item.status === status).length;

  function exportCsv() {
    const rows: (string | number)[][] = [["顺序", "数据类型", "招生年份", "院校代号", "院校", "批次", "科类", "计划类别", "专业组", "计划人数", "组内专业", "选科初筛", "核验说明", "数据核验", "计划快照时间", "官方来源"]];
    savedIds.forEach((id, index) => {
      const official = officialSavedGroups.find((group) => group.id === id);
      if (official) {
        const check = checks.get(id)!;
        rows.push([index + 1, "官方计划", official.year, official.schoolCode, official.schoolName, official.offering.batch, official.offering.subject, official.offering.planCategory, official.offering.professionalGroup || "未标注", official.offering.planCount, official.offering.majors.map((major) => `${major.code} ${major.name}`).join("；"), check.status === "eligible" ? "初筛通过" : check.status === "blocked" ? "选科不符" : "待核验", check.reason, verificationLabels[official.verification], official.catalogGeneratedAt, official.sourceUrl]);
      } else {
        const demo = savedGroups.find((group) => group.id === id);
        if (demo) rows.push([index + 1, "早期演示，不可用于填报", "", "", demo.school, "", "", "", demo.group, "", demo.majors.join("；"), "不评估", "请从官方院校库重新选择", "演示数据", "", ""]);
      }
    });
    const content = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `蒙志愿-方案草稿-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <SiteShell active="/volunteer-list">
      <div className="platform-page volunteer-page">
        <PageIntro eyebrow="MY APPLICATION PLAN" title="我的志愿表" description="把官方专业组放在一起，按意愿排序，并随考生档案变化重新核对选科。方案保存在当前浏览器。" actions={<Link className="primary-link" href="/schools">继续添加专业组 →</Link>} />
        <ProfileSnapshot compact />
        <DataNotice label="本地方案草稿" kind="reference">这里是方案草稿，不会提交到考试院。官方组尚未建立可靠的跨年专业构成与位次对应，因此暂不标注冲稳保或录取概率。</DataNotice>
        {!storageAvailable && <p className="feedback-message" role="alert">浏览器未允许持久保存，当前操作仅在本次页面会话有效，请导出 CSV 留存。</p>}
        {!hydrated ? <div className="official-loading" role="status"><span /><p>正在恢复本机方案与官方专业组…</p></div> : savedIds.length ? <>
          <section className="volunteer-summary" aria-label="当前档案下的专业组核验">
            <div><b>{officialSavedGroups.length}</b><span>官方专业组</span></div>
            <div className="qualified"><b>{count("eligible")}</b><span>选科初筛通过</span></div>
            <div className="warning"><b>{count("blocked")}</b><span>选科不符</span></div>
            <div><b>{count("review")}</b><span>仍需核验</span></div>
          </section>
          <section className="card volunteer-board">
            <div className="board-toolbar">
              <div><span className="eyebrow">当前方案 · 档案变更后自动复核</span><h2>{savedIds.length} 个备选条目</h2></div>
              <div><button type="button" onClick={sortSaved}>按核验状态整理</button><button type="button" onClick={exportCsv}>导出 CSV</button><button type="button" onClick={() => window.print()}>打印方案</button><button className="danger-button" type="button" onClick={() => { if (window.confirm("确认清空当前设备上的志愿表吗？考生档案不会被删除。")) clearSaved(); }}>清空</button></div>
            </div>
            <p className="section-explainer">不同批次、科类与计划类别在官方系统分别填报；下方顺序仅表示你的备选意愿。人工调整优先级后可导出留档。</p>
            <div className="board-list">
              {savedIds.map((id, index) => {
                const official = officialSavedGroups.find((group) => group.id === id);
                const demo = savedGroups.find((group) => group.id === id);
                if (!official && !demo) return null;
                const schoolName = official?.schoolName || demo!.school;
                const check = official ? checks.get(id)! : null;
                return <article className={`board-item ${official ? "official-board-item" : "legacy-board-item"}`} key={id}>
                  <div className="board-order"><span>{String(index + 1).padStart(2, "0")}</span><div><button type="button" aria-label={`上移 ${schoolName} ${official?.offering.professionalGroup || ""}`} disabled={index === 0} onClick={() => moveSaved(id, -1)}>↑</button><button type="button" aria-label={`下移 ${schoolName} ${official?.offering.professionalGroup || ""}`} disabled={index === savedIds.length - 1} onClick={() => moveSaved(id, 1)}>↓</button></div></div>
                  <span className="risk-badge">{official ? "官" : "示"}</span>
                  <div className="board-school">
                    <Link href={official ? `/schools/detail?school=${encodeURIComponent(official.schoolId)}&group=${encodeURIComponent(official.offering.id)}` : `/schools?q=${encodeURIComponent(schoolName)}`}>{schoolName}</Link>
                    <strong>{official ? `${official.year} · 专业组 ${official.offering.professionalGroup || "未标注"}` : `${demo!.group} · 早期演示`}</strong>
                    {official && <small>{official.offering.batch} · {official.offering.subject} · {official.offering.planCategory}</small>}
                    <small>{official ? official.offering.majors.map((major) => major.name).join("、") : "请从官方院校库重新选择；此条目不能作为填报依据。"}</small>
                  </div>
                  <div className="board-basis"><span>{official ? "当年招生计划" : "数据状态"}</span><strong>{official ? `${official.offering.planCount} 人` : "演示条目"}</strong><small>{official ? verificationLabels[official.verification] : "分数与计划均不作为真实依据"}</small>{official && <a href={official.sourceUrl} target="_blank" rel="noreferrer">考试院计划原文 ↗</a>}</div>
                  <div className={`board-check ${check?.status === "eligible" ? "eligible" : "blocked"}`}><strong>{check ? check.status === "eligible" ? "✓ 选科初筛通过" : check.status === "blocked" ? "! 选科不符" : "待核验" : "不作资格评估"}</strong><small>{check?.reason || "先选择官方专业组"}</small></div>
                  <button className="remove-button" type="button" aria-label={`移除 ${schoolName} ${official?.offering.professionalGroup || ""}`} onClick={() => removeSaved(id)}>移除</button>
                </article>;
              })}
            </div>
          </section>
          <section className="board-next-steps">
            <div><span>1</span><strong>补齐组内专业意愿</strong><p>在当年章程中核对专业顺序、学费、办学地点与调剂范围。</p><Link href="/tools/restrictions">检查限报条件 →</Link></div>
            <div><span>2</span><strong>核对填报窗口</strong><p>每个批次单独安排时间，特殊招生还需完成资格、面试和体检。</p><Link href="/notices">查看官方公告 →</Link></div>
            <div><span>3</span><strong>前往官方系统</strong><p>本平台不保存考试院账号或密码。正式提交后，请在官方系统确认结果。</p><a href={OFFICIAL_GAOKAO_URL} target="_blank" rel="noreferrer">打开平安高考 ↗</a></div>
          </section>
        </> : <EmptyState title="从一个真实专业组开始" description="打开院校库，查看当年的官方招生计划，再把感兴趣的专业组加入这里。无需先录入成绩，也可以先建立备选清单。" action={<div className="empty-actions"><Link className="primary-link" href="/schools">浏览官方院校库</Link><Link className="secondary-link" href="/profile">完善考生档案</Link></div>} />}
      </div>
    </SiteShell>
  );
}
