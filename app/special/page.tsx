"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OFFICIAL_GAOKAO_URL } from "../platform-data";
import { Breadcrumbs, PageIntro, SiteShell } from "../platform-components";
import { trackGuides } from "./special-guides";
import "./special.css";

const storageKey = "mengzhiyuan-special-checklist-2026-v1";
type Checked = Record<string, number[]>;
export default function SpecialPage() {
  const [active, setActive] = useState("military");
  const [checked, setChecked] = useState<Checked>({});
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    const syncUrl = () => {
      const requested = new URLSearchParams(window.location.search).get("type");
      if (requested && trackGuides.some((item) => item.id === requested)) setActive(requested);
    };
    const timer = window.setTimeout(() => {
      syncUrl();
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}") as unknown;
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          const valid: Checked = {};
          for (const track of trackGuides) {
            const indices = (saved as Record<string, unknown>)[track.id];
            if (Array.isArray(indices)) valid[track.id] = [...new Set(indices.filter((item): item is number => typeof item === "number" && Number.isInteger(item) && item >= 0 && item < track.checks.length))];
          }
          setChecked(valid);
        }
      } catch { setStatus("本地记录不可用；本次仍可使用清单，关闭页面后可能不保存。"); }
      setReady(true);
    }, 0);
    window.addEventListener("popstate", syncUrl);
    return () => { window.clearTimeout(timer); window.removeEventListener("popstate", syncUrl); };
  }, []);
  const track = trackGuides.find((item) => item.id === active) ?? trackGuides[0];
  const done = checked[track.id] ?? [];
  function selectTrack(id: string) {
    setActive(id);
    const url = new URL(window.location.href); url.searchParams.set("type", id);
    window.history.replaceState(null, "", url);
  }
  function toggleCheck(index: number) {
    const next = { ...checked, [track.id]: done.includes(index) ? done.filter((item) => item !== index) : [...done, index] };
    setChecked(next);
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); setStatus("清单已保存到此浏览器。"); } catch { setStatus("本次已勾选，浏览器无法保存；可下载清单留存。"); }
  }
  function exportChecklist() {
    const lines = ["蒙志愿 · 特殊招生核对清单", `类别：${track.title}`, "参考年度：2026（请按本人报考年度重新核对）", "本清单仅记录本人阅读进度，不代表资格审核通过。", "", ...track.checks.map((item, index) => `${done.includes(index) ? "[已核对]" : "[待核对]"} ${item}`), "", "官方来源：", ...track.sources.map((source) => `${source.title}\n${source.url}`)];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `蒙志愿-${track.title}-核对清单.txt`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("清单已生成，可与家长一起逐项核对。");
  }

  return (
    <SiteShell active="/special">
      <div className="platform-page special-page">
        <Breadcrumbs items={[{ label: "首页", href: "/" }, { label: "特殊招生" }]} />
        <PageIntro eyebrow="MORE THAN ONE PATH" title="不同升学路径，各有一张路线图" description="军校、公安、司法、艺术、体育、中外合作与香港高校，分别核对资格、流程和组内专业。重要的前置步骤，不等出分才开始。" actions={<Link className="secondary-link" href="/notices">查看公告与时间线 →</Link>} />
        <div className="special-policy-note"><span>2026 政策参考</span><p>依据考试院及高校官方页面整理。具体日期请打开对应原文；跨年度报考需重新核对。下方勾选仅记录阅读进度，不作资格判定。</p></div>
        <section className="special-layout">
          <nav className="special-side-nav" aria-label="特殊招生类型">
            {trackGuides.map((item) => <button type="button" className={active === item.id ? "active" : ""} onClick={() => selectTrack(item.id)} key={item.id} aria-pressed={active === item.id} aria-controls="special-track-detail"><span>{item.icon}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><b>→</b></button>)}
          </nav>
          <article className="card special-detail-card" id="special-track-detail">
            <div className="special-detail-heading"><span>{track.icon}</span><div><small>SPECIAL ADMISSIONS</small><h2>{track.title}</h2><p>{track.subtitle}</p></div></div>
            <p className="special-summary">{track.summary}</p>
            <div className="special-focus"><span>先记住这一点</span><strong>{track.focus}</strong></div>
            <h3 className="track-section-title">从准备，到具体志愿</h3>
            <ol className="special-route-map">{track.steps.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{step.title}</h4><p>{step.detail}</p></div></li>)}</ol>
            <section className="special-checklist">
              <div><h3>我的核对清单</h3><span>{done.length} / {track.checks.length} 项已核对</span></div>
              <progress max={track.checks.length} value={done.length} aria-label="清单阅读进度" />
              {track.checks.map((item, index) => <label key={item}><input type="checkbox" checked={done.includes(index)} disabled={!ready} onChange={() => toggleCheck(index)} /><span>{item}</span></label>)}
              <p>即使全部勾选，也不代表获得报考资格。资格以主管部门、考试院及院校结论为准。</p>
              <button type="button" className="secondary-action" onClick={exportChecklist}>下载本类核对清单 ↓</button>
              <span className="special-storage-status" role="status">{status || "勾选进度仅保存在当前浏览器，不同步至官方系统。"}</span>
            </section>
            <div className="special-risk-panel"><h3>容易忽略的细节</h3><ul>{track.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></div>
            <section className="special-sources"><h3>直接核对官方原文</h3>{track.sources.map((source) => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}><div><strong>{source.title}</strong><small>{source.publisher} · 新窗口打开</small></div><span>↗</span></a>)}</section>
            <div className="special-detail-actions"><Link className="primary-link" href="/schools">到官方院校库查看专业组 →</Link><a className="secondary-link" href={OFFICIAL_GAOKAO_URL} target="_blank" rel="noreferrer">平安高考 ↗</a></div>
          </article>
        </section>
      </div>
    </SiteShell>
  );
}

