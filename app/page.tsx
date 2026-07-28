"use client";

import { useMemo, useState } from "react";

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string } }>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const officialUrl = "https://www.nm.zsks.cn/ztzl/pagkpt/";

const timeline = [
  {
    date: "06.20—06.22",
    title: "志愿填报模拟演练",
    detail: "使用 2026 年真实招生计划，熟悉院校专业组填报流程。",
    status: "已结束",
    type: "演练",
  },
  {
    date: "06.24",
    title: "提前批意向类别志愿",
    detail: "军校、公安、司法、消防救援等先填意向，再参加资格审查。",
    status: "已结束",
    type: "关键",
  },
  {
    date: "07.05—07.10",
    title: "本科提前批 A / B 段",
    detail: "特殊类型、军警校、艺术体育等分阶段投档录取。",
    status: "已结束",
    type: "录取",
  },
  {
    date: "07.20—07.25",
    title: "本科批三次征集志愿",
    detail: "剩余计划按院校专业组再次征集，公告时间窗口较短。",
    status: "已结束",
    type: "征集",
  },
  {
    date: "08.02",
    title: "高职（专科）提前批艺术体育",
    detail: "开始模拟投档；后续节点以考试院最新公告为准。",
    status: "即将开始",
    type: "提醒",
  },
];

const specialTracks = [
  {
    icon: "盾",
    title: "军校",
    subtitle: "政治考核 · 面试 · 体检",
    color: "olive",
    count: "提前批 B 段",
  },
  {
    icon: "警",
    title: "公安 / 司法",
    subtitle: "体能测评 · 资格名单",
    color: "navy",
    count: "10 所公安院校",
  },
  {
    icon: "艺",
    title: "艺术 / 体育",
    subtitle: "双上线 · 综合分换算",
    color: "purple",
    count: "10 类艺术统考",
  },
  {
    icon: "合",
    title: "中外合作",
    subtitle: "学费 · 外语 · 培养模式",
    color: "amber",
    count: "单独标识",
  },
  {
    icon: "港",
    title: "港校 / 特殊招生",
    subtitle: "统招与独立招生分流",
    color: "cyan",
    count: "独立时间线",
  },
];

const groups = [
  {
    risk: "冲",
    riskClass: "rush",
    school: "大连理工大学",
    group: "物理＋化学组",
    majors: "计算机类、电子信息类、软件工程",
    change: "+2",
    fit: "92%",
  },
  {
    risk: "稳",
    riskClass: "steady",
    school: "内蒙古大学",
    group: "物理＋化学组",
    majors: "电子信息类、数理基础科学、机械工程",
    change: "持平",
    fit: "89%",
  },
  {
    risk: "稳",
    riskClass: "steady",
    school: "东北林业大学",
    group: "物理＋化学组",
    majors: "计算机类、林学类、数据科学",
    change: "+4",
    fit: "86%",
  },
  {
    risk: "保",
    riskClass: "safe",
    school: "内蒙古工业大学",
    group: "物理＋化学组",
    majors: "电气类、计算机类、能源动力类",
    change: "-1",
    fit: "81%",
  },
];

const notices = [
  {
    tag: "志愿公告",
    title: "本科批剩余计划第三次暨最后一次征集志愿",
    date: "07-25",
    important: true,
  },
  {
    tag: "志愿公告",
    title: "本科批剩余计划第二次征集志愿",
    date: "07-22",
    important: false,
  },
  {
    tag: "志愿公告",
    title: "本科批剩余计划第一次征集志愿",
    date: "07-20",
    important: false,
  },
  {
    tag: "特殊招生",
    title: "2026 年公安院校在内蒙古地区招生工作实施办法",
    date: "06-16",
    important: false,
  },
];

const quickTools = [
  ["位", "一分一段", "查位次"],
  ["线", "批次控制线", "看门槛"],
  ["PK", "院校专业组 PK", "横向比较"],
  ["增", "扩缩招查询", "看计划变化"],
  ["同", "往年同位去向", "看真实选择"],
  ["限", "体检限报自查", "排除风险"],
];

function SectionTitle({
  eyebrow,
  title,
  extra,
}: {
  eyebrow?: string;
  title: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
      </div>
      {extra}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [noticeFilter, setNoticeFilter] = useState("全部");
  const [voiceText, setVoiceText] = useState(
    "想留在北方，优先计算机和电子信息，学费不要太高，可以接受中外合作"
  );
  const [listening, setListening] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [activeNav, setActiveNav] = useState("首页");

  const parsedNeeds = useMemo(() => {
    const text = voiceText;
    const needs = [];
    if (/北方|北京|天津|东北|内蒙古/.test(text)) needs.push("北方地区");
    if (/计算机|软件|人工智能/.test(text)) needs.push("计算机类");
    if (/电子|通信|自动化/.test(text)) needs.push("电子信息类");
    if (/学费|便宜|预算/.test(text)) needs.push("学费优先");
    if (/中外|合作/.test(text)) needs.push("接受中外合作");
    if (/军校|军事/.test(text)) needs.push("军校");
    if (/警校|公安|司法/.test(text)) needs.push("公安司法");
    return needs.length ? needs : ["等待识别偏好"];
  }, [voiceText]);

  const filteredGroups = groups.filter((item) =>
    `${item.school}${item.group}${item.majors}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const filteredNotices = notices.filter(
    (item) => noticeFilter === "全部" || item.tag === noticeFilter
  );

  function toggleSaved(school: string) {
    setSaved((current) =>
      current.includes(school)
        ? current.filter((item) => item !== school)
        : [...current, school]
    );
  }

  function startVoice() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceText("当前浏览器暂不支持语音识别，请直接输入：例如“物理类 560 分，想学计算机，优先北方公办院校”。");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      setVoiceText(event.results[0][0].transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function scrollTo(id: string, nav: string) {
    setActiveNav(nav);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <main>
      <div className="official-strip">
        <span>
          <i className="pulse" />
          数据口径：内蒙古自治区教育考试院 · 计划每小时同步
        </span>
        <span className="strip-right">
          最近整理：2026-07-28 15:00
          <a href={officialUrl} target="_blank" rel="noreferrer">
            查看官方来源 ↗
          </a>
        </span>
      </div>

      <header className="site-header">
        <a className="brand" href="#">
          <span className="brand-mark">蒙</span>
          <span>
            <strong>蒙志愿</strong>
            <small>内蒙古高考志愿智能决策平台</small>
          </span>
        </a>
        <nav aria-label="主导航">
          {["首页", "智能选志愿", "院校专业组", "志愿表", "数据工具"].map(
            (item) => (
              <button
                className={activeNav === item ? "active" : ""}
                key={item}
                onClick={() =>
                  scrollTo(
                    item === "首页"
                      ? "top"
                      : item === "智能选志愿"
                        ? "smart"
                        : item === "院校专业组"
                          ? "groups"
                          : item === "志愿表"
                            ? "groups"
                            : "tools",
                    item
                  )
                }
              >
                {item}
              </button>
            )
          )}
        </nav>
        <a
          className="safe-gaokao"
          href={officialUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="打开内蒙古招生考试信息网平安高考"
        >
          <span className="hand">☝</span>
          <span>
            <small>官方入口</small>
            平安高考
          </span>
          <b>↗</b>
        </a>
      </header>

      <section className="hero" id="top">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker">2026 · 新高考院校专业组模式</span>
            <h1>
              把复杂的院校专业组，
              <br />
              排成一张<span>看得懂的志愿表</span>
            </h1>
            <p>
              以官方招生计划为底座，合并历年专业组、位次与特殊招生资格，
              <br />
              AI 帮你解释选择，不替你做决定。
            </p>
            <div className="hero-actions">
              <button onClick={() => scrollTo("smart", "智能选志愿")}>
                开始智能选志愿 <span>→</span>
              </button>
              <button
                className="ghost"
                onClick={() => scrollTo("groups", "院校专业组")}
              >
                先查院校专业组
              </button>
            </div>
            <div className="trust-row">
              <span>✓ 官方信息可追溯</span>
              <span>✓ 专业组跨年对齐</span>
              <span>✓ 特殊资格前置校验</span>
            </div>
          </div>

          <div className="profile-card">
            <div className="profile-head">
              <span>我的 2026 志愿档案</span>
              <button>编辑</button>
            </div>
            <div className="score-row">
              <div>
                <strong>558</strong>
                <span>预估分</span>
              </div>
              <div>
                <strong>12,460</strong>
                <span>预估位次</span>
              </div>
            </div>
            <div className="profile-tags">
              <span>物理类</span>
              <span>物理＋化学＋生物</span>
              <span>呼和浩特</span>
            </div>
            <div className="profile-divider" />
            <div className="chance-head">
              <span>当前可选方案</span>
              <small>演示数据</small>
            </div>
            <div className="chance-grid">
              <div className="rush">
                <b>26</b>
                <span>可冲</span>
              </div>
              <div className="steady">
                <b>48</b>
                <span>较稳</span>
              </div>
              <div className="safe">
                <b>31</b>
                <span>可保</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="alert-bar">
        <span className="alert-icon">!</span>
        <strong>当前提醒</strong>
        <p>
          本科批第三次暨最后一次征集已结束。高职（专科）提前批艺术、体育类
          8 月 2 日开始模拟投档。
        </p>
        <a href={officialUrl} target="_blank" rel="noreferrer">
          去官方专栏核验 ↗
        </a>
      </section>

      <div className="content">
        <section className="smart-grid" id="smart">
          <div className="card ai-card">
            <SectionTitle
              eyebrow="AI 志愿助手"
              title="说出你的想法，自动变成筛选条件"
              extra={<span className="live-tag">支持普通话</span>}
            />
            <p className="section-desc">
              分数只是起点。地域、专业、家庭预算、身体条件和职业方向都应该进入同一套筛选。
            </p>
            <div className="voice-box">
              <button
                className={`mic ${listening ? "listening" : ""}`}
                onClick={startVoice}
                aria-label="开始语音输入"
              >
                {listening ? "•••" : "●"}
              </button>
              <textarea
                aria-label="志愿需求"
                value={voiceText}
                onChange={(event) => setVoiceText(event.target.value)}
              />
              <button className="send" onClick={() => setVoiceText(voiceText.trim())}>
                分析需求 →
              </button>
            </div>
            <div className="parsed">
              <span>AI 已提取</span>
              <div>
                {parsedNeeds.map((need) => (
                  <button key={need}>{need} ×</button>
                ))}
              </div>
            </div>
            <div className="ai-result">
              <span className="spark">✦</span>
              <p>
                建议先按 <b>物理＋化学</b> 专业组建立 3:4:3
                梯度，再单独评估高收费专业。已识别的偏好可匹配
                <strong> 42 个院校专业组</strong>。
              </p>
              <button onClick={() => scrollTo("groups", "院校专业组")}>
                查看推荐
              </button>
            </div>
          </div>

          <aside className="card timeline-card">
            <SectionTitle
              eyebrow="官方日程"
              title="2026 志愿与录取时间轴"
              extra={
                <a href={officialUrl} target="_blank" rel="noreferrer">
                  全部公告
                </a>
              }
            />
            <div className="timeline">
              {timeline.map((item, index) => (
                <div
                  className={`timeline-item ${item.status === "即将开始" ? "upcoming" : ""}`}
                  key={item.title}
                >
                  <div className="timeline-rail">
                    <i />
                    {index < timeline.length - 1 && <span />}
                  </div>
                  <div className="timeline-date">{item.date}</div>
                  <div className="timeline-copy">
                    <div>
                      <strong>{item.title}</strong>
                      <em>{item.status}</em>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="special-section">
          <SectionTitle
            eyebrow="内蒙古特色招生全覆盖"
            title="不再把特殊招生藏在普通院校里"
            extra={<button className="text-button">查看全部招生类型 →</button>}
          />
          <div className="special-grid">
            {specialTracks.map((track) => (
              <button className="special-card" key={track.title}>
                <span className={`special-icon ${track.color}`}>{track.icon}</span>
                <span className="special-copy">
                  <strong>{track.title}</strong>
                  <small>{track.subtitle}</small>
                </span>
                <span className="special-count">{track.count}</span>
                <b>→</b>
              </button>
            ))}
          </div>
        </section>

        <section className="card group-card" id="groups">
          <SectionTitle
            eyebrow="核心决策工作台"
            title="院校专业组跨年对比"
            extra={
              <div className="table-actions">
                <span>{saved.length} 个已加入志愿表</span>
                <button>打开志愿表 →</button>
              </div>
            }
          />
          <div className="group-explainer">
            <span className="explainer-mark">组</span>
            <p>
              2026 年除本科提前批 A 段外，内蒙古其他批（段）次采用
              <b>“院校专业组”平行志愿</b>。系统按选科要求与专业构成对齐往年组别，
              不直接拿校最低分替代专业组风险。
            </p>
            <a href="https://www.nm.zsks.cn/ztzl/pagkpt/zcgd/202606/t20260604_46401.html" target="_blank" rel="noreferrer">
              查看政策原文 ↗
            </a>
          </div>
          <div className="filter-row">
            <label>
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索院校、专业或专业组"
              />
            </label>
            {["物理类", "本科批", "公办", "北方地区"].map((item) => (
              <button key={item}>
                {item} <span>⌄</span>
              </button>
            ))}
            <button className="all-filter">全部筛选 · 6</button>
          </div>
          <div className="data-note">
            <span>产品演示数据</span>
            当前院校专业组与匹配度用于展示产品交互，不作为实际填报依据；正式数据管道将以考试院招生计划为准。
          </div>
          <div className="group-table">
            <div className="table-row table-head">
              <span>梯度</span>
              <span>院校 / 专业组</span>
              <span>组内代表专业</span>
              <span>计划变化</span>
              <span>偏好匹配</span>
              <span>操作</span>
            </div>
            {filteredGroups.map((item) => (
              <div className="table-row" key={item.school}>
                <span>
                  <i className={`risk-badge ${item.riskClass}`}>{item.risk}</i>
                </span>
                <span className="school-cell">
                  <strong>{item.school}</strong>
                  <small>{item.group}</small>
                </span>
                <span className="majors">{item.majors}</span>
                <span className={item.change.startsWith("+") ? "up" : ""}>
                  {item.change}
                </span>
                <span>
                  <b className="fit">{item.fit}</b>
                </span>
                <span>
                  <button
                    className={saved.includes(item.school) ? "saved" : "add"}
                    onClick={() => toggleSaved(item.school)}
                  >
                    {saved.includes(item.school) ? "已加入 ✓" : "加入志愿表"}
                  </button>
                </span>
              </div>
            ))}
            {!filteredGroups.length && (
              <div className="empty">没有匹配的演示记录，请尝试其他关键词。</div>
            )}
          </div>
        </section>

        <section className="lower-grid">
          <div className="card notice-card">
            <SectionTitle
              eyebrow="每小时整理"
              title="官方公告雷达"
              extra={<span className="sync-state">● 自动同步运行中</span>}
            />
            <div className="notice-tabs">
              {["全部", "志愿公告", "特殊招生"].map((item) => (
                <button
                  className={noticeFilter === item ? "active" : ""}
                  onClick={() => setNoticeFilter(item)}
                  key={item}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="notice-list">
              {filteredNotices.map((notice) => (
                <a href={officialUrl} target="_blank" rel="noreferrer" key={notice.title}>
                  <span className="notice-date">
                    <b>{notice.date.split("-")[1]}</b>
                    <small>07 月</small>
                  </span>
                  <span className="notice-main">
                    <em>{notice.tag}</em>
                    {notice.important && <i>重要</i>}
                    <strong>{notice.title}</strong>
                    <small>来源：内蒙古自治区教育考试院</small>
                  </span>
                  <b>↗</b>
                </a>
              ))}
            </div>
            <div className="crawler-note">
              <span>抓取窗口</span>
              每年 6 月 7 日—8 月 20 日，每小时整理一次；原文、发布时间与来源链接完整保留。
            </div>
          </div>

          <div className="card tools-card" id="tools">
            <SectionTitle eyebrow="决策数据" title="高考工具箱" />
            <div className="tool-grid">
              {quickTools.map(([icon, title, subtitle]) => (
                <button key={title}>
                  <span>{icon}</span>
                  <strong>{title}</strong>
                  <small>{subtitle}</small>
                </button>
              ))}
            </div>
            <div className="safety-card">
              <span>退档风险检查</span>
              <strong>
                不是“够线”就能报
              </strong>
              <p>
                选科、单科、外语语种、体检、专项资格、蒙古语文要求将逐条检查。
              </p>
              <button>开始自查 →</button>
            </div>
          </div>
        </section>

        <section className="official-source">
          <div>
            <span className="seal">官</span>
            <p>
              <strong>所有结论都能回到官方原文</strong>
              平台只做信息整理与辅助决策，正式填报请以内蒙古招生考试信息网和高校招生章程为准。
            </p>
          </div>
          <div className="source-links">
            <a href="https://www.nm.zsks.cn/" target="_blank" rel="noreferrer">
              内蒙古招生考试信息网 ↗
            </a>
            <a href={officialUrl} target="_blank" rel="noreferrer">
              平安高考专题 ↗
            </a>
            <a href="https://gaokao.chsi.com.cn/" target="_blank" rel="noreferrer">
              阳光高考招生章程 ↗
            </a>
          </div>
        </section>
      </div>

      <footer>
        <a className="brand footer-brand" href="#">
          <span className="brand-mark">蒙</span>
          <span>
            <strong>蒙志愿</strong>
            <small>先看懂规则，再做选择</small>
          </span>
        </a>
        <p>
          本平台为高考志愿辅助工具，不替代官方填报系统，不承诺录取结果。
          <br />
          数据更新时间、来源链接与演示数据状态将在页面显著标注。
        </p>
        <span>© 2026 蒙志愿 · 长期建设中</span>
      </footer>
    </main>
  );
}
