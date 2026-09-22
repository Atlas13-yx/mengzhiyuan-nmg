import Link from "next/link";
import { toolRoutes } from "../platform-data";
import { DataNotice, PageIntro, ProfileSnapshot, SiteShell } from "../platform-components";

const guideCards = [
  { title: "先确认位次", detail: "使用 2026 年同科类的一分一段表，区分同分区间与个人排名。", href: "/tools/rank" },
  { title: "再核对资格", detail: "选科、体检、语种和单科要求都可能构成门槛。", href: "/tools/restrictions" },
  { title: "核对组内专业", detail: "跨年比较前先查科类、批次和专业构成，相同组号不等于相同招生内容。", href: "/tools/compare" },
] as const;
const toolDescriptions: Record<string, { title: string; subtitle: string }> = {
  "/tools/plan-change": { title: "招生计划核对", subtitle: "查看已选组计划，标明跨年数据缺口" },
  "/tools/same-rank": { title: "位次与历史分数", subtitle: "查询本人位次，再逐校核对历史记录" },
};
export default function ToolsPage() {
  return (
    <SiteShell active="/tools">
      <div className="platform-page tools-hub-page">
        <PageIntro eyebrow="DECISION TOOLS" title="高考数据工具箱" description="把一分一段、控制线、专业组比较、招生计划与限报核对拆成独立工具，逐项找到判断依据。" />
        <ProfileSnapshot compact />
        <DataNotice kind="reference" label="工具数据范围">已接入 2026 年普通类一分一段、招生计划与 2025 年官方历史分数。跨年专业组构成和同位次去向尚未完整接入，对应工具会明确标出缺口。</DataNotice>
        <section className="tool-hub-grid">
          {toolRoutes.map((tool, index) => {
            const description = toolDescriptions[tool.href] ?? tool;
            return <Link href={tool.href} className="tool-hub-card" key={tool.href}><span>{tool.icon}</span><small>0{index + 1}</small><strong>{description.title}</strong><p>{description.subtitle}</p><b>打开工具 →</b></Link>;
          })}
        </section>
        <section className="tool-guide-section">
          <div className="section-title"><div><span className="eyebrow">使用顺序</span><h2>把影响填报的条件逐项核对</h2></div></div>
          <div className="tool-guide-grid">{guideCards.map((card, index) => <Link href={card.href} key={card.href}><span>{index + 1}</span><strong>{card.title}</strong><p>{card.detail}</p><b>继续 →</b></Link>)}</div>
        </section>
      </div>
    </SiteShell>
  );
}

