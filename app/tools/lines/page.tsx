"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DataNotice } from "../../platform-components";
import { usePlatform } from "../../platform-state";
import { controlLineDifference, controlLineSource, officialControlLines, type OrdinaryExamTrack } from "../../lines-data";
import { ToolPageShell } from "../tool-shell";

export default function LinesToolPage() {
  const { profile, hydrated, profileConfigured } = usePlatform();
  const [track, setTrack] = useState<OrdinaryExamTrack>("物理");

  useEffect(() => {
    if (!hydrated || !profileConfigured) return;
    const syncTimer = window.setTimeout(() => setTrack(profile.firstSubject), 0);
    return () => window.clearTimeout(syncTimer);
  }, [hydrated, profileConfigured, profile.firstSubject]);

  return (
    <ToolPageShell
      eyebrow="2026 · OFFICIAL CONTROL LINES"
      title="批次控制线"
      description="核对 2026 年内蒙古普通类控制线。保存本人档案后，可查看同科类成绩与控制线的差值。"
    >
      <DataNotice label="官方已公布 · 2026" kind="official">来源：{controlLineSource.publisher}，{controlLineSource.publishedAt} 发布，{controlLineSource.verifiedAt} 核验。此处仅展示普通物理类与普通历史类；专项类、艺术、体育和对口招生请查看原文对应类别。</DataNotice>
      <section className="card lines-workbench">
        <div className="segmented-tabs" role="group" aria-label="选择普通类科类">
          {(["物理", "历史"] as const).map((item) => <button type="button" aria-pressed={track === item} className={track === item ? "active" : ""} onClick={() => setTrack(item)} key={item}>2026 普通{item}类</button>)}
        </div>
        <div className="line-cards">
          {officialControlLines[track].map((line, index) => {
            const difference = controlLineDifference({
              hydrated, profileConfigured, profileTrack: profile.firstSubject,
              viewedTrack: track, score: profile.score, lineScore: line.score,
            });
            return (
              <article key={line.id}>
                <span>2026 · 普通{track}类 · 0{index + 1}</span>
                <strong>{line.label}</strong>
                <b>{line.score}<small>分</small></b>
                {difference !== null && <em className={difference >= 0 ? "line-above" : "line-below"}>{difference === 0 ? "与控制线持平" : difference > 0 ? `高于 ${difference} 分` : `低于 ${Math.abs(difference)} 分`}</em>}
                <p>{line.description}</p>
                <a href={controlLineSource.url} target="_blank" rel="noreferrer" className="secondary-link">查看官方原文 ↗</a>
              </article>
            );
          })}
        </div>
        {hydrated && !profileConfigured && <div className="tool-official-note"><p>尚未保存本人成绩；当前展示官方控制线，填写档案后再比较分差。</p><Link href="/profile">填写本人档案 →</Link></div>}
        {hydrated && profileConfigured && track !== profile.firstSubject && <div className="tool-official-note"><p>当前浏览普通{track}类，你的档案为{profile.firstSubject}类；不同科类不计算分差。</p><button type="button" className="secondary-action" onClick={() => setTrack(profile.firstSubject)}>查看我的科类</button></div>}
        <div className="tool-official-note"><p>控制线是批次门槛，不是院校专业组投档线，也不代表录取结果。各专项与特殊类型资格须另行核验。</p><a href={controlLineSource.url} target="_blank" rel="noreferrer">完整控制线公告 ↗</a></div>
      </section>
    </ToolPageShell>
  );
}

