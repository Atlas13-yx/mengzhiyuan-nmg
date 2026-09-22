"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { admissionsAsset, formatNumber, type AdmissionsCatalog } from "../admissions-data";
import { usePlatform } from "../platform-state";
import { PageIntro, ProfileSnapshot, SiteShell } from "../platform-components";
import { majorOptions, parseNeeds, parseCatalogFilter, matchesCatalog, type CatalogFilter, type Needs } from "./needs-parser";
import "./smart.css";

type SpeechRecognitionLike = {
  lang: string; interimResults: boolean; continuous: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
const blankFilter: CatalogFilter = { schoolQuery: "", subject: "", batch: "", maxTuition: "" };
const voiceErrors: Record<string, string> = {
  "not-allowed": "麦克风权限被拒绝。请在浏览器的网站权限中允许麦克风，或直接输入文字。",
  "service-not-allowed": "浏览器未允许语音识别服务，请改用文字输入。",
  "audio-capture": "没有检测到可用麦克风，请检查设备连接。",
  "no-speech": "没有听到清晰语音，请重新开始，或直接输入文字。",
  network: "语音识别服务连接失败。请检查网络，或直接输入文字。",
};

export default function SmartPage() {
  const { profile } = usePlatform();
  const [text, setText] = useState("想看看物理类本科，学费每年 6000 元以内，倾向北方的计算机或电子信息。");
  const [catalog, setCatalog] = useState<AdmissionsCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState<CatalogFilter>(blankFilter);
  const [preferences, setPreferences] = useState<Needs | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [applied, setApplied] = useState<CatalogFilter | null>(null);
  const [stage, setStage] = useState<"input" | "review" | "applied">("input");
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(12);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const receivedVoice = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(admissionsAsset("/data/admissions-2026/catalog.json"), { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error("catalog"); return response.json() as Promise<AdmissionsCatalog>; })
      .then((data) => { setCatalog(data); setLoadError(""); })
      .catch((reason) => { if (reason instanceof DOMException && reason.name === "AbortError") return; setLoadError("官方院校目录暂时无法载入，请重试。你的输入会保留。"); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const timer = window.setTimeout(() => setVoiceSupported(Boolean((speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition) && window.isSecureContext)), 0);
    return () => {
      window.clearTimeout(timer);
      const recognition = recognitionRef.current;
      if (recognition) { recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.abort(); }
    };
  }, []);
  const results = useMemo(() => catalog && applied ? catalog.schools.filter((school) => matchesCatalog(school, applied)).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")) : [], [catalog, applied]);

  function analyze() {
    if (!text.trim()) { setMessage("先写一句需求，或点击下方示例。"); return; }
    const parsed = parseNeeds(text);
    const filter = parseCatalogFilter(text, catalog?.schools ?? [], /历史类/.test(text) ? "历史类" : /物理类/.test(text) ? "物理类" : `${profile.firstSubject}类`);
    setPreferences(parsed.needs);
    const nextNotes = parsed.notes.filter((note) => !(note.startsWith("未提取") && (filter.schoolQuery || filter.batch)));
    const mentionedSchools = catalog?.schools.filter((school) => text.includes(school.name)) ?? [];
    if (mentionedSchools.some((school) => !filter.schoolQuery.includes(school.name))) nextNotes.push("提到了多所院校；本次草稿先填入其中一所，可编辑名称或清空后查看全部院校。");
    setNotes(nextNotes);
    setDraft(filter);
    setStage("review");
    setMessage("条件已整理，请检查下方筛选项，再确认应用。");
  }
  function editFilter(patch: Partial<CatalogFilter>) { setDraft((current) => ({ ...current, ...patch })); setStage("review"); }
  function applyFilters() {
    if (draft.maxTuition && (!/^\d+$/.test(draft.maxTuition) || Number(draft.maxTuition) <= 0)) { setMessage("学费上限请填写大于 0 的整数，留空表示不限。"); return; }
    setApplied({ ...draft }); setVisible(12); setStage("applied"); setMessage("已应用目录初筛。请进入院校详情，核对同一个专业组内是否满足全部条件。");
  }
  function startVoice() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition || !window.isSecureContext) { setVoiceError("当前环境不支持语音识别，请使用支持此功能的浏览器并通过 HTTPS 访问，或直接输入文字。"); return; }
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    receivedVoice.current = false;
    recognition.lang = "zh-CN"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0].transcript).join("").trim();
      if (transcript) { receivedVoice.current = true; setText(transcript); setStage("input"); setMessage("语音已转成文字，请检查识别结果后点击“整理需求”。"); }
    };
    recognition.onend = () => { setListening(false); recognitionRef.current = null; if (!receivedVoice.current) setVoiceError((current) => current || "未得到识别文本，可以重试或直接输入。"); };
    recognition.onerror = (event) => { setListening(false); setVoiceError(voiceErrors[event.error] || "语音识别已中断，请重试或直接输入文字。"); };
    setVoiceError(""); setListening(true);
    try { recognition.start(); } catch { setListening(false); setVoiceError("语音无法启动，请稍后重试或直接输入。"); }
  }
  function updatePreference(key: "region" | "schoolType", value: string) {
    setPreferences((current) => current ? { ...current, [key]: value } : current);
  }

  return (
    <SiteShell active="/smart">
      <div className="platform-page smart-page">
        <PageIntro eyebrow="YOUR ADMISSIONS WORKSPACE" title="把想法，变成可核对的选择" description="输入或说出需求，确认筛选条件，再从官方招生计划逐组核对。每一步都能看到使用了什么、还缺什么。" actions={<Link className="secondary-link" href="/volunteer-list">查看我的志愿表 →</Link>} />
        <ProfileSnapshot />
        <div className="smart-capabilities"><span><i />本地规则解析已启用</span><span>语音由浏览器提供</span><span>AI 模型服务待接入</span></div>
        <section className="smart-workspace">
          <div className="card smart-prompt-card">
            <div className="section-title"><div><span className="eyebrow">01 · 描述需求</span><h2>你想在哪里，读什么？</h2></div></div>
            <label className="sr-only" htmlFor="needs-input">输入报考需求</label>
            <textarea id="needs-input" className="needs-input" rows={4} value={text} placeholder="例如：想看内蒙古大学的本科计划，学费不超过 6000 元" onChange={(event) => { setText(event.target.value); setStage("input"); setMessage(""); }} />
            <div className="smart-input-actions">
              <button className={listening ? "voice-action listening" : "voice-action"} type="button" onClick={startVoice} aria-pressed={listening} disabled={voiceSupported === false}>{listening ? "■ 结束录音" : "◉ 语音输入"}</button>
              <button className="primary-action" type="button" onClick={analyze} disabled={listening || !catalog}>整理需求 →</button>
            </div>
            <p className="smart-helper">{voiceSupported === false ? "当前浏览器不支持语音识别，可完整使用文字输入。" : "普通话语音识别可能调用浏览器提供商的在线服务；点击后才会请求麦克风权限。"}</p>
            {voiceError && <p className="field-error" role="alert">{voiceError}</p>}
            <div className="smart-examples"><span>试试这样说</span>{["本科，学费每年 6000 元以内", "想了解内蒙古大学的物理类招生计划"].map((example) => <button type="button" key={example} onClick={() => { setText(example); setStage("input"); setMessage(""); }}>{example} ↗</button>)}</div>
            {loadError && <div className="smart-load-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoadError(""); setRetry((value) => value + 1); }}>重新加载目录</button></div>}
            <p className="smart-status" role="status" aria-live="polite">{message || (!catalog && !loadError ? "正在加载官方院校目录…" : "自然语言只生成草稿，确认后才应用到结果。")}</p>
          </div>
          <aside className="card smart-explain-card">
            <span className="eyebrow">看得见的筛选依据</span><h2>这次筛选能做到什么</h2>
            <ul><li><b>官方计划</b><span>{catalog ? `${formatNumber(catalog.meta.schoolCount)} 个院校招生单元 · ${catalog.meta.year} 年招生目录` : "正在载入考试院招生目录"}</span></li><li><b>初筛字段</b><span>院校名称 / 代号、科类、批次、学费区间。</span></li><li><b>下一步核验</b><span>再选科目、专业方向、单科与体检要求，必须在同一个专业组内核对。</span></li><li><b>保留偏好</b><span>地域、公民办等字段尚未完整接入，先记为待核验偏好，不参与自动过滤。</span></li></ul>
            <Link className="secondary-link" href="/special">军警 / 艺体 / 合作 / 港校 →</Link>
          </aside>
        </section>
        {preferences && (
          <section className="card smart-review-card" aria-label="确认解析条件">
            <div className="section-title"><div><span className="eyebrow">02 · 编辑与确认</span><h2>先看一眼，我们理解得对吗？</h2></div><span className="smart-stage-label">{stage === "applied" ? "已应用" : "待确认草稿"}</span></div>
            {stage === "input" && <p className="smart-pending-note">输入文字已变化，下面仍是上一次草稿。请重新整理需求，或直接编辑下面条件。</p>}
            <div className="needs-filter-grid">
              <label><span>院校名称 / 代号</span><input value={draft.schoolQuery} placeholder="不限院校" onChange={(event) => editFilter({ schoolQuery: event.target.value })} /></label>
              <label><span>招生科类</span><select value={draft.subject} onChange={(event) => editFilter({ subject: event.target.value })}><option value="">全部科类</option>{catalog?.filters.subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>招生批次</span><select value={draft.batch} onChange={(event) => editFilter({ batch: event.target.value })}><option value="">全部批次</option>{catalog?.filters.batches.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>年度学费上限（元）</span><input inputMode="numeric" value={draft.maxTuition} placeholder="不限学费" onChange={(event) => editFilter({ maxTuition: event.target.value })} /></label>
            </div>
            <p className="smart-helper">学费只依据该校已知最低学费初筛，未知学费在设置上限时排除；不同科类、批次和费用可能属于不同专业组，并不代表所选专业组全部满足条件。</p>
            <details className="preference-details" open><summary>已记录的偏好 · 需要逐组核验，不参与本次初筛</summary>
              <div className="preference-editors"><label>地域<select value={preferences.region} onChange={(event) => updatePreference("region", event.target.value)}>{["不限", "内蒙古", "北方", "区外"].map((item) => <option key={item}>{item}</option>)}</select></label><label>院校类型<select value={preferences.schoolType} onChange={(event) => updatePreference("schoolType", event.target.value)}>{["不限", "公办", "民办", "双一流"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
              <fieldset className="major-preferences"><legend>喜欢的专业方向（可多选，满足其一即可）</legend>{majorOptions.map((major) => <label key={major}><input type="checkbox" checked={preferences.majors.includes(major)} onChange={() => setPreferences((current) => current ? { ...current, majors: current.majors.includes(major) ? current.majors.filter((item) => item !== major) : [...current.majors, major] } : current)} />{major}</label>)}</fieldset>
              {preferences.excludedMajors.length > 0 && <div className="smart-exclusions">不接受组内包含：{preferences.excludedMajors.map((major) => <button key={major} type="button" onClick={() => setPreferences((current) => current ? { ...current, excludedMajors: current.excludedMajors.filter((item) => item !== major) } : current)}>{major} ×</button>)}</div>}
            </details>
            {notes.length > 0 && <ul className="parse-notes">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
            <div className="review-actions"><button type="button" className="secondary-action" onClick={() => editFilter({ ...blankFilter, subject: `${profile.firstSubject}类` })}>清空初筛条件</button><button className="primary-action" type="button" onClick={applyFilters} disabled={!catalog || stage === "input"}>确认条件，查看院校 →</button></div>
          </section>
        )}
        <section className="smart-results" aria-live="polite">
          <div className="section-title"><div><span className="eyebrow">03 · 进入专业组核对</span><h2>{applied ? `找到 ${results.length} 个院校招生单元` : "确认条件后，显示官方目录结果"}</h2></div><Link className="text-button" href="/schools">完整院校专业组库 →</Link></div>
          {applied && <div className="smart-applied-tags"><span>已应用</span>{[applied.schoolQuery || "院校不限", applied.subject || "科类不限", applied.batch || "批次不限", applied.maxTuition ? `最低已知学费 ≤ ${applied.maxTuition} 元/年` : "学费不限"].map((item) => <b key={item}>{item}</b>)}{stage !== "applied" && <em>结果仍基于上次确认条件</em>}</div>}
          {!applied ? <div className="smart-before-results"><span>01 说出需求</span><b>→</b><span>02 确认条件</span><b>→</b><span>03 查看专业组</span></div> : results.length ? <><p className="smart-helper">按院校名称排序。本页不生成录取概率或冲稳保结论；科类初筛也不等于通过全部选科资格。</p><div className="smart-official-grid">{results.slice(0, visible).map((school) => <article className="smart-official-card" key={school.id}><span className="official-code">2026 官方计划 · 院校代号 {school.code}</span><h3>{school.name}</h3><p>{school.batches.join(" / ")}</p><div className="smart-card-facts"><div><strong>{school.groupCount}</strong><span>专业组 / 招生单元</span></div><div><strong>{school.tuitionMin === null ? "待查" : `${formatNumber(school.tuitionMin)} 起`}</strong><span>已知学费（元/年）</span></div></div><Link href={`/schools/detail?school=${encodeURIComponent(school.id)}`} className="secondary-action">核对专业、选科与学费 →</Link></article>)}</div>{visible < results.length && <button className="official-load-more" type="button" onClick={() => setVisible((count) => count + 12)}>继续查看（还有 {results.length - visible} 个）</button>}</> : <div className="platform-empty"><span>⌕</span><h2>没有符合当前目录条件的院校</h2><p>可以放宽批次或学费上限；未发布数值学费的院校不会进入预算筛选结果。</p><button className="primary-action" type="button" onClick={() => { const next = { ...blankFilter, subject: applied.subject }; setDraft(next); setApplied(next); setStage("applied"); }}>仅保留科类条件</button></div>}
        </section>
      </div>
    </SiteShell>
  );
}
