"use client";

import { useEffect, useMemo, useState } from "react";
import { lookupRank, SCORE_RANK_SOURCE, type ExamTrack } from "../../score-ranks";
import { usePlatform } from "../../platform-state";
import { ToolPageShell } from "../tool-shell";

export default function RankToolPage() {
  const { profile, saveProfile, hydrated } = usePlatform();
  const [track, setTrack] = useState<ExamTrack>(profile.firstSubject);
  const [score, setScore] = useState(profile.score);
  const [synced, setSynced] = useState(false);
  const [touched, setTouched] = useState(false);
  const scoreValue = /^\d{1,3}$/.test(score) && Number(score) <= 750 ? Number(score) : null;
  const rank = useMemo(() => scoreValue === null ? null : lookupRank(track, scoreValue), [scoreValue, track]);
  const scoreError = score && scoreValue === null
    ? "请输入 0—750 之间的整数，不要输入小数、负号或其他字符。"
    : score && !rank
      ? "官方一分一段表中没有该分数的单独记录。"
      : "";

  useEffect(() => {
    if (!hydrated || touched) return;
    const syncTimer = window.setTimeout(() => {
      setTrack(profile.firstSubject);
      setScore(profile.score);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [hydrated, profile.firstSubject, profile.score, touched]);

  function syncProfile() {
    if (!hydrated || !rank) return;
    setSynced(saveProfile({ ...profile, firstSubject: track, score }));
  }

  return (
    <ToolPageShell
      eyebrow="SCORE RANK LOOKUP"
      title="一分一段位次查询"
      description="输入 2026 年内蒙古普通类成绩，自动匹配同分人数、位次区间与累计位次。"
    >
      <section className="tool-workbench rank-workbench">
        <div className="card tool-input-card">
          <span className="eyebrow">输入条件</span>
          <h2>查询成绩位次</h2>
          <label><span>科类</span><select value={track} onChange={(event) => { setTrack(event.target.value as ExamTrack); setTouched(true); setSynced(false); }}><option value="物理">普通物理类</option><option value="历史">普通历史类</option></select></label>
          <label><span>高考成绩（含照顾分）</span><input value={score} inputMode="numeric" aria-invalid={Boolean(scoreError)} aria-describedby="rank-tool-score-help" onChange={(event) => { setScore(event.target.value); setTouched(true); setSynced(false); }} placeholder="0—750" /><small id="rank-tool-score-help" className={scoreError ? "field-error" : "field-help"}>{scoreError || "输入后自动匹配同分人数和位次区间。"}</small></label>
          <button type="button" className="primary-action" disabled={!hydrated || !rank} onClick={syncProfile}>{hydrated ? "同步到个人档案" : "正在恢复档案…"}</button>
          {synced && <p className="inline-success">✓ 已同步，其他页面将使用新成绩和科类。</p>}
        </div>
        <div className="card rank-result-card" aria-live="polite">
          {rank ? (
            <>
              <span className="eyebrow">查询结果</span>
              <div className="rank-big-number"><strong>{rank.rank.toLocaleString("zh-CN")}</strong><span>累计人数（同分区间末位）</span></div>
              <div className="rank-result-grid">
                <div><span>成绩</span><b>{score} 分</b></div>
                <div><span>同分人数</span><b>{rank.sameScoreCount} 人</b></div>
                <div><span>同分位次区间</span><b>{rank.rangeStart.toLocaleString("zh-CN")}—{rank.rangeEnd.toLocaleString("zh-CN")}</b></div>
                <div><span>科类</span><b>普通{track}类</b></div>
              </div>
              <p>同分考生在实际投档中还要结合具体排序规则，不能只用区间末位判断。</p>
              <a href={SCORE_RANK_SOURCE} target="_blank" rel="noreferrer">查看官方一分一段表 ↗</a>
            </>
          ) : (
            <div className="platform-empty compact-empty"><span>位</span><h2>暂无对应记录</h2><p>{scoreError || "请输入有效成绩，或切换物理类 / 历史类后重试。"}</p></div>
          )}
        </div>
      </section>
    </ToolPageShell>
  );
}
