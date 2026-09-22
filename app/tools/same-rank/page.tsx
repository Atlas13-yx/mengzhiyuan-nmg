"use client";

import Link from "next/link";
import { lookupRank, SCORE_RANK_SOURCE } from "../../score-ranks";
import { usePlatform } from "../../platform-state";
import { DataNotice } from "../../platform-components";
import { ToolPageShell } from "../tool-shell";

export default function SameRankToolPage() {
  const { profile, profileConfigured, officialSavedGroups } = usePlatform();
  const rank = profileConfigured ? lookupRank(profile.firstSubject, Number(profile.score)) : null;
  const schools = [...new Map(officialSavedGroups.map((group) => [group.schoolId, group])).values()];

  return (
    <ToolPageShell eyebrow="RANK & HISTORICAL RECORDS" title="位次与历史分数" description="查询自己的 2026 年普通类位次，再逐校查看有来源的历史投档与录取记录。跨年度同位次去向数据尚未接入，不生成同位推荐名单。">
      <DataNotice kind="reference" label="历史去向待接入">当前可以核对 2026 一分一段和院校 2025 年官方分数记录；尚缺跨年度同口径的位次去向与完整专业组构成，不能据此判断录取概率或冲稳保。</DataNotice>
      {rank ? (
        <>
          <section className="same-rank-summary">
            <div><span>2026 年档案成绩</span><strong>{profile.score}<small>分</small></strong></div>
            <div><span>同分位次区间</span><strong>{rank.rangeStart.toLocaleString("zh-CN")}—{rank.rangeEnd.toLocaleString("zh-CN")}<small>名</small></strong></div>
            <div><span>同分人数 · {profile.firstSubject}类</span><strong>{rank.sameScoreCount.toLocaleString("zh-CN")}<small>人</small></strong></div>
            <Link href="/profile">修改成绩与选科 →</Link>
          </section>
          <div className="tool-official-note"><span>同分区间不是个人精确排名；区间内的投档排序还要依据当年同分规则。</span><a href={SCORE_RANK_SOURCE} target="_blank" rel="noreferrer">核对官方一分一段 ↗</a></div>
        </>
      ) : <div className="platform-empty"><span>位</span><h2>{profileConfigured ? "当前成绩未查到有效位次" : "先填写自己的考生档案"}</h2><p>{profileConfigured ? "请检查成绩、科类及数据覆盖范围；没有对应记录时不估算个人排名。" : "填写 2026 年普通类成绩与选科后，这里会显示官方同分位次区间。"}</p><Link className="primary-link" href="/profile">完善档案</Link></div>}
      <section className="same-rank-results">
        <div className="section-title"><div><span className="eyebrow">官方历史记录</span><h2>{schools.length ? "查看已选院校的历史分数" : "从院校详情继续核对"}</h2></div><Link href="/schools">完整官方院校库 →</Link></div>
        {schools.length > 0 && <div className="tool-guide-grid">{schools.map((group) => <Link href={`/schools/detail?school=${encodeURIComponent(group.schoolId)}`} key={group.schoolId}><span>查</span><strong>{group.schoolName}</strong><p>这是你已选的院校，不是系统按位次生成的推荐。进入详情后按科类、批次与投档 / 录取口径核对历史分数。</p><b>查看真实记录 →</b></Link>)}</div>}
        <div className="card plan-workbench"><h3>比较之前，先确认三件事</h3><ol className="field-help"><li>历史记录是否属于相同科类、批次和计划类别。</li><li>对比的是投档最低分，还是院校专业录取最低分；征集轮次也需分开。</li><li>两年专业组的专业构成与选科要求是否一致；相同组号不能证明组内专业未变。</li></ol><Link className="secondary-link" href="/schools">检索官方院校与历史记录 →</Link></div>
      </section>
    </ToolPageShell>
  );
}
