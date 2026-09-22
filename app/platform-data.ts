export const OFFICIAL_GAOKAO_URL = "https://www.nm.zsks.cn/ztzl/pagkpt/";
export const SUBJECT_POLICY_URL =
  "https://www.nm.zsks.cn/ztzl/pagkpt/zcgd/202509/t20250930_46058.html";
export const LANGUAGE_PAPER_POLICY_URL =
  "https://www.nm.zsks.cn/ztzl/pagkpt/zcgd/202509/t20250930_46059.html";

export type RiskLevel = "冲" | "稳" | "保";

export type SchoolGroup = {
  id: string;
  school: string;
  location: string;
  province: string;
  type: string;
  tags: string[];
  group: string;
  requirements: string[];
  majors: string[];
  risk: RiskLevel;
  fit: number;
  change: number;
  plan: number;
  tuition: string;
  rankLow: number;
  rankHigh: number;
  summary: string;
};

export const schoolGroups: SchoolGroup[] = [
  {
    id: "dlut-physics-chemistry",
    school: "大连理工大学",
    location: "大连",
    province: "辽宁",
    type: "公办",
    tags: ["双一流", "985", "理工强校"],
    group: "物理＋化学组",
    requirements: ["物理", "化学"],
    majors: ["计算机类", "电子信息类", "软件工程"],
    risk: "冲",
    fit: 92,
    change: 2,
    plan: 38,
    tuition: "6240 元/年",
    rankLow: 9200,
    rankHigh: 13200,
    summary: "工科优势突出，组内专业相关度高，适合作为冲刺梯度。",
  },
  {
    id: "imu-physics-chemistry",
    school: "内蒙古大学",
    location: "呼和浩特",
    province: "内蒙古",
    type: "公办",
    tags: ["双一流", "区内优先", "综合大学"],
    group: "物理＋化学组",
    requirements: ["物理", "化学"],
    majors: ["电子信息类", "数理基础科学", "机械工程"],
    risk: "稳",
    fit: 89,
    change: 0,
    plan: 176,
    tuition: "5060 元/年",
    rankLow: 12800,
    rankHigh: 18500,
    summary: "区内招生计划稳定，专业覆盖面广，适合作为主稳方案。",
  },
  {
    id: "nefu-physics-chemistry",
    school: "东北林业大学",
    location: "哈尔滨",
    province: "黑龙江",
    type: "公办",
    tags: ["双一流", "行业特色", "北方地区"],
    group: "物理＋化学组",
    requirements: ["物理", "化学"],
    majors: ["计算机类", "林学类", "数据科学与大数据技术"],
    risk: "稳",
    fit: 86,
    change: 4,
    plan: 64,
    tuition: "5500 元/年",
    rankLow: 14600,
    rankHigh: 21800,
    summary: "计划小幅增加，计算机与行业特色专业可组合评估。",
  },
  {
    id: "imut-physics-chemistry",
    school: "内蒙古工业大学",
    location: "呼和浩特",
    province: "内蒙古",
    type: "公办",
    tags: ["区内优先", "工科", "就业导向"],
    group: "物理＋化学组",
    requirements: ["物理", "化学"],
    majors: ["电气类", "计算机类", "能源动力类"],
    risk: "保",
    fit: 81,
    change: -1,
    plan: 428,
    tuition: "4600 元/年",
    rankLow: 20500,
    rankHigh: 35000,
    summary: "区内计划充足，工科就业方向明确，可作为保底梯度。",
  },
  {
    id: "buaa-physics-chemistry",
    school: "北京航空航天大学",
    location: "北京",
    province: "北京",
    type: "公办",
    tags: ["双一流", "985", "航空航天"],
    group: "物理＋化学组",
    requirements: ["物理", "化学"],
    majors: ["工科试验班", "人工智能", "自动化类"],
    risk: "冲",
    fit: 88,
    change: 1,
    plan: 22,
    tuition: "5500 元/年",
    rankLow: 2400,
    rankHigh: 6200,
    summary: "高位次工科冲刺选择，需重点核对组内专业与单科要求。",
  },
  {
    id: "nmu-history-politics",
    school: "内蒙古民族大学",
    location: "通辽",
    province: "内蒙古",
    type: "公办",
    tags: ["师范", "医学", "区内优先"],
    group: "历史＋思想政治组",
    requirements: ["历史", "思想政治"],
    majors: ["汉语言文学", "法学", "思想政治教育"],
    risk: "稳",
    fit: 84,
    change: 3,
    plan: 206,
    tuition: "4200 元/年",
    rankLow: 9800,
    rankHigh: 19000,
    summary: "历史类专业组合清晰，师范与法学方向兼顾。",
  },
  {
    id: "nankai-history-politics",
    school: "南开大学",
    location: "天津",
    province: "天津",
    type: "公办",
    tags: ["双一流", "985", "综合大学"],
    group: "历史＋思想政治组",
    requirements: ["历史", "思想政治"],
    majors: ["经济学类", "法学", "历史学类"],
    risk: "冲",
    fit: 90,
    change: 0,
    plan: 18,
    tuition: "5200 元/年",
    rankLow: 900,
    rankHigh: 3200,
    summary: "人文社科实力强，招生计划少，适合高位次冲刺。",
  },
  {
    id: "nmgau-physics-biology",
    school: "内蒙古农业大学",
    location: "呼和浩特",
    province: "内蒙古",
    type: "公办",
    tags: ["行业特色", "区内优先", "农林"],
    group: "物理＋生物学组",
    requirements: ["物理", "生物学"],
    majors: ["动物医学", "食品科学与工程", "智慧农业"],
    risk: "保",
    fit: 78,
    change: 6,
    plan: 512,
    tuition: "4600 元/年",
    rankLow: 26000,
    rankHigh: 52000,
    summary: "特色专业辨识度高，计划增加，适合关注农林与食品方向的考生。",
  },
];

export const specialTracks = [
  { id: "military", icon: "盾", title: "军校", subtitle: "政治考核、面试与体检", count: "意向与资格核验" },
  { id: "police", icon: "警", title: "公安 / 司法", subtitle: "体能测评与资格名单", count: "单独资格链路" },
  { id: "arts", icon: "艺", title: "艺术 / 体育", subtitle: "双上线与综合分换算", count: "统考分类核验" },
  { id: "joint", icon: "合", title: "中外合作", subtitle: "学费、外语与培养模式", count: "单独费用标签" },
  { id: "hk", icon: "港", title: "港校 / 特殊招生", subtitle: "统招与独立招生分流", count: "独立时间线" },
] as const;

export const toolRoutes = [
  { href: "/tools/rank", icon: "位", title: "一分一段", subtitle: "输入成绩自动查同分位次" },
  { href: "/tools/lines", icon: "线", title: "批次控制线", subtitle: "物理类、历史类门槛对照" },
  { href: "/tools/compare", icon: "PK", title: "院校专业组 PK", subtitle: "两组横向比较" },
  { href: "/tools/plan-change", icon: "增", title: "计划与年度变化", subtitle: "核对当前计划与历史缺口" },
  { href: "/tools/same-rank", icon: "同", title: "同位次参考", subtitle: "查看位次与历史数据口径" },
  { href: "/tools/restrictions", icon: "限", title: "限报风险自查", subtitle: "选科、体检和资格逐项检查" },
] as const;

export const notices = [
  { tag: "志愿公告", title: "普通高校招生网上填报志愿公告与阶段提醒", date: "08-02", important: true, url: OFFICIAL_GAOKAO_URL },
  { tag: "政策解读", title: "2026 年院校专业组模式与投档规则说明", date: "07-30", important: true, url: "https://www.nm.zsks.cn/ztzl/pagkpt/zcgd/202606/t20260604_46401.html" },
  { tag: "特殊招生", title: "公安、军校等特殊类型招生资格核验入口", date: "07-16", important: false, url: OFFICIAL_GAOKAO_URL },
  { tag: "数据发布", title: "2026 年普通类各分数段人数统计表", date: "06-25", important: false, url: "https://www.nm.zsks.cn/fzlm/26gktj/" },
] as const;

export const controlLines = {
  物理: [
    ["特殊类型参考线", 482],
    ["本科控制线", 392],
    ["高职（专科）控制线", 160],
  ],
  历史: [
    ["特殊类型参考线", 505],
    ["本科控制线", 425],
    ["高职（专科）控制线", 160],
  ],
} as const;
