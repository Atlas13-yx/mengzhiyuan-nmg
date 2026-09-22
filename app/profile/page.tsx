"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { lookupRank, SCORE_RANK_SOURCE } from "../score-ranks";
import { LANGUAGE_PAPER_POLICY_URL, SUBJECT_POLICY_URL } from "../platform-data";
import {
  secondSubjectOptions,
  usePlatform,
  validateSubjectCombination,
  type SecondSubject,
  type VolunteerProfile,
} from "../platform-state";
import { Breadcrumbs, PageIntro, SiteShell } from "../platform-components";

export default function ProfilePage() {
  const { profile, saveProfile, hydrated } = usePlatform();
  const [draft, setDraft] = useState<VolunteerProfile>(profile);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const scoreInputRef = useRef<HTMLInputElement>(null);
  const subjectGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => setDraft(profile), 0);
    return () => window.clearTimeout(syncTimer);
  }, [profile]);
  const scoreValue = /^\d{1,3}$/.test(draft.score) && Number(draft.score) <= 750
    ? Number(draft.score)
    : null;
  const rank = useMemo(
    () => scoreValue === null ? null : lookupRank(draft.firstSubject, scoreValue),
    [draft.firstSubject, scoreValue]
  );
  const combination = validateSubjectCombination(draft);
  const scoreError = draft.score && scoreValue === null
    ? "请输入 0—750 之间的整数；不要输入小数、负号或其他字符。"
    : draft.score && !rank
      ? "该分数在当前普通类一分一段表中没有单独记录。"
      : "";
  const completeCount = 2 + (combination.valid ? 1 : 0) + (rank ? 1 : 0);

  function update<Key extends keyof VolunteerProfile>(key: Key, value: VolunteerProfile[Key]) {
    setSaved(false);
    setError("");
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleSubject(subject: SecondSubject) {
    setSaved(false);
    setError("");
    if (!draft.secondSubjects.includes(subject) && draft.secondSubjects.length >= 2) {
      setError("再选科目只能选择 2 门，请先取消一门再选择。");
      return;
    }
    update(
      "secondSubjects",
      draft.secondSubjects.includes(subject)
        ? draft.secondSubjects.filter((item) => item !== subject)
        : [...draft.secondSubjects, subject]
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated) {
      setError("档案正在从当前设备恢复，请稍后再保存。");
      return;
    }
    if (scoreValue === null) {
      setError("高考成绩须为 0—750 之间的整数。");
      scoreInputRef.current?.focus();
      return;
    }
    if (!combination.valid) {
      setError(combination.reason);
      subjectGroupRef.current?.focus();
      return;
    }
    if (!rank) {
      setError("该分数在 2026 年普通类一分一段表中没有对应记录，请核对成绩或科类。");
      return;
    }
    if (saveProfile(draft)) {
      setSaved(true);
      setError("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <SiteShell active="/profile">
      <div className="platform-page profile-page">
        <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "个人志愿档案" }]} />
        <PageIntro
          eyebrow="VOLUNTEER PROFILE"
          title="个人志愿档案"
          description="填写普通类成绩与选科，用于位次查询和专业组选科初筛。档案只保存在当前浏览器，不上传考生信息，也不代替官方资格审核。"
          actions={<Link className="secondary-link" href="/smart">前往智能选志愿 →</Link>}
        />

        {saved && (
          <div className="success-banner" role="status">
            <strong>✓ 档案已保存并同步到全部页面</strong>
            <span>新的成绩、位次和选科资格已经生效。</span>
            <Link href="/smart">按新档案筛选院校 →</Link>
          </div>
        )}

        <form className="standalone-profile-form" onSubmit={submit}>
          <section className="profile-form-section required-section">
            <div className="profile-form-title">
              <div><h2>填写考生信息</h2><p>用于确定普通类科类、可报专业组与同分位次。</p></div>
              <span className="required-progress">必填 {completeCount}/4</span>
            </div>
            <div className="core-fields">
              <label className="profile-field"><span>高考省份</span><select value="内蒙古" disabled><option>内蒙古</option></select></label>
              <label className="profile-field">
                <span>首选科目</span>
                <select value={draft.firstSubject} onChange={(event) => update("firstSubject", event.target.value as "物理" | "历史")}>
                  <option value="物理">物理类</option><option value="历史">历史类</option>
                </select>
              </label>
              <label className="profile-field">
                <span>高考成绩（含照顾分）</span>
                <input ref={scoreInputRef} value={draft.score} inputMode="numeric" placeholder="请输入 0—750" aria-invalid={Boolean(scoreError)} aria-describedby="score-field-help" onChange={(event) => update("score", event.target.value)} />
                <small id="score-field-help" className={scoreError ? "field-error" : "field-help"}>{scoreError || "保留原始输入并按普通类一分一段表匹配。"}</small>
              </label>
              <label className="profile-field rank-field">
                <span>同分位次区间 <i className="help-trigger" tabIndex={0} aria-label="位次口径说明：按 2026 年普通类一分一段表自动匹配" title="按 2026 年普通类一分一段表自动匹配">i</i></span>
                <input readOnly value={rank ? `${rank.rangeStart.toLocaleString("zh-CN")}—${rank.rangeEnd.toLocaleString("zh-CN")}` : ""} placeholder="输入成绩后自动匹配" />
              </label>
            </div>
            <div className="subject-policy standalone-subject-policy" ref={subjectGroupRef} role="group" tabIndex={-1} aria-labelledby="second-subject-label" data-invalid={!combination.valid} aria-describedby="second-subject-help">
              <div className="subject-policy-copy"><strong id="second-subject-label">再选科目</strong><span>从 4 门中选择且仅选择 2 门</span></div>
              <div className="subject-options" aria-label="再选科目">
                {secondSubjectOptions.map((subject) => {
                  const selected = draft.secondSubjects.includes(subject);
                  const disabled = !selected && draft.secondSubjects.length >= 2;
                  return <button type="button" aria-pressed={selected} disabled={disabled} title={disabled ? "请先取消一门已选科目" : undefined} className={selected ? "selected" : ""} onClick={() => toggleSubject(subject)} key={subject}><span>{selected ? "✓" : "+"}</span>{subject}</button>;
                })}
              </div>
              <a href={SUBJECT_POLICY_URL} target="_blank" rel="noreferrer">查看内蒙古选科政策 ↗</a>
              <small id="second-subject-help" className={combination.valid ? "field-help" : "field-error"}>{combination.reason}</small>
            </div>
            <p className="policy-scope">当前自动校验覆盖国家通用语言授课普通类 3+1+2 组合；原民族语言授课考生还需按<a href={LANGUAGE_PAPER_POLICY_URL} target="_blank" rel="noreferrer">官方信息采集办法</a>核对数学卷种与蒙文翻译卷联动。</p>
            {rank ? (
              <div className="rank-note">
                <span>✓</span><p>2026 年内蒙古普通{draft.firstSubject}类：<b>{draft.score} 分</b>同分位次为 <strong>{rank.rangeStart.toLocaleString("zh-CN")}—{rank.rangeEnd.toLocaleString("zh-CN")} 名</strong>，共 {rank.sameScoreCount} 人。</p>
                <a href={SCORE_RANK_SOURCE} target="_blank" rel="noreferrer">官方一分一段表 ↗</a>
              </div>
            ) : draft.score ? (
              <div className="rank-note rank-note-empty"><span>!</span><p>{scoreError || `该分数在普通${draft.firstSubject}类表中没有单独记录。`}</p></div>
            ) : null}
          </section>

          <section className="profile-form-section preference-section">
            <div className="profile-form-title"><div><h2>填写志愿偏好</h2><p>这些偏好会参与智能匹配排序，但不会覆盖选科等硬性条件。</p></div><span className="optional-tag">选填</span></div>
            <div className="preference-grid">
              <label className="profile-field"><span>所在城市</span><select value={draft.city} onChange={(event) => update("city", event.target.value)}>{["呼和浩特","包头","赤峰","鄂尔多斯","呼伦贝尔","通辽","其他盟市"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="profile-field"><span>目标院校</span><input value={draft.targetSchool} placeholder="例如：内蒙古大学" onChange={(event) => update("targetSchool", event.target.value)} /></label>
              <label className="profile-field"><span>地域偏好</span><select value={draft.preferredRegion} onChange={(event) => update("preferredRegion", event.target.value)}>{["不限地域","内蒙古优先","北方地区","一线及新一线","接受全国"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="profile-field"><span>专业偏好</span><input value={draft.preferredMajor} placeholder="例如：计算机、临床医学" onChange={(event) => update("preferredMajor", event.target.value)} /></label>
              <label className="profile-field"><span>院校属性</span><select value={draft.schoolType} onChange={(event) => update("schoolType", event.target.value)}>{["不限","公办优先","双一流优先","行业特色院校","接受中外合作"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="profile-field"><span>学费倾向</span><select value={draft.tuition} onChange={(event) => update("tuition", event.target.value)}>{["不限","每年 6 千元以内","每年 1 万元以内","每年 3 万元以内","可接受高学费"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="profile-field"><span>职业倾向</span><input value={draft.career} placeholder="未来想从事的职业领域" onChange={(event) => update("career", event.target.value)} /></label>
              <label className="profile-field"><span>毕业规划</span><select value={draft.graduationPlan} onChange={(event) => update("graduationPlan", event.target.value)}>{["暂未确定","优先就业","计划考研","考公考编","出国深造","创业"].map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className="profile-field"><span>性格特点</span><select value={draft.personality} onChange={(event) => update("personality", event.target.value)}>{["暂未确定","理性务实","探索创新","耐心细致","善于沟通","组织领导"].map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
          </section>

          <section className="profile-form-section notes-section">
            <div className="profile-form-title"><div><h2>其他偏好</h2><p>补充身体条件、家庭期望或不接受的专业与地区。</p></div><span className="optional-tag">选填</span></div>
            <textarea value={draft.notes} maxLength={300} placeholder="例如：不想去寒冷地区；不接受医学类专业；希望院校有保研资格……" onChange={(event) => update("notes", event.target.value)} />
            <small>{draft.notes.length}/300</small>
          </section>

          <div className="standalone-form-footer">
            <p className={error ? "form-error visible" : "form-error"} aria-live="polite">{error || "档案仅保存在当前设备，可随时再次编辑。"}</p>
            <div><Link className="cancel-profile" href="/">返回首页</Link><button className="save-profile" type="submit" disabled={!hydrated}>{hydrated ? "保存并同步档案" : "正在恢复档案…"}</button></div>
          </div>
        </form>
      </div>
    </SiteShell>
  );
}
