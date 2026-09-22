import type { AdmissionsSchoolSummary } from "../admissions-data.ts";

export const majorOptions = ["计算机", "电子信息", "医学", "农林食品", "文史法学"] as const;
export type MajorPreference = typeof majorOptions[number];
export type Needs = {
  region: "不限" | "内蒙古" | "北方" | "区外";
  schoolType: "不限" | "公办" | "民办" | "双一流";
  majors: MajorPreference[];
  excludedMajors: MajorPreference[];
  maxTuition: string;
};
export const emptyNeeds: Needs = { region: "不限", schoolType: "不限", majors: [], excludedMajors: [], maxTuition: "" };
const majorPatterns: Record<MajorPreference, RegExp> = {
  计算机: /计算机|软件|人工智能|数据科学|大数据/,
  电子信息: /电子|通信|自动化|电气/,
  医学: /医学|临床|护理|口腔/,
  农林食品: /农学|农业|农林|林学|食品|生物/,
  文史法学: /文学|汉语言|历史学|法学|思想政治|中文/,
};

export function parseNeeds(text: string): { needs: Needs; notes: string[] } {
  const needs: Needs = { ...emptyNeeds, majors: [], excludedMajors: [] };
  const notes: string[] = [];
  if (/区外|不(?:想|要|考虑|去|在).{0,3}(?:内蒙古|区内)/.test(text)) needs.region = "区外";
  else if (/内蒙古|区内/.test(text)) needs.region = "内蒙古";
  else if (/北方|东北|华北/.test(text)) needs.region = "北方";
  if (/双一流|985|211/.test(text)) needs.schoolType = "双一流";
  else if (/公办|不(?:要|考虑).{0,2}民办/.test(text)) needs.schoolType = "公办";
  else if (/民办/.test(text)) needs.schoolType = "民办";
  const clauses = text.split(/[，。；,;\n]/);
  for (const major of majorOptions) {
    for (const clause of clauses) {
      const match = majorPatterns[major].exec(clause);
      if (!match) continue;
      const prefix = clause.slice(0, match.index);
      const excluded = /(?:不想|不要|不考虑|排除|不读|不学)[^或和与但]{0,8}$/.test(prefix);
      const list = excluded ? needs.excludedMajors : needs.majors;
      if (!list.includes(major)) list.push(major);
    }
  }
  needs.majors = needs.majors.filter((item) => !needs.excludedMajors.includes(item));
  const budget = text.match(/(?:学费|预算)[^，。；,;\n\d]{0,10}(\d+(?:\.\d+)?)\s*(万|千)?/);
  const chineseBudget = text.match(/(?:学费|预算)[^，。；,;\n]{0,8}?([一二两三四五六七八九十])\s*(万|千)/);
  if (budget) needs.maxTuition = String(Number(budget[1]) * (budget[2] === "万" ? 10000 : budget[2] === "千" ? 1000 : 1));
  else if (chineseBudget) {
    const digits: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    needs.maxTuition = String(digits[chineseBudget[1]] * (chineseBudget[2] === "万" ? 10000 : 1000));
  }
  if (/便宜|不(?:要|想)太高|不要太贵/.test(text) && !needs.maxTuition) notes.push("“学费不要太高”没有明确金额，请手动填写预算上限。");
  if (/985|211/.test(text)) notes.push("985 / 211 暂归为“双一流”候选条件，两者并不等同，请按院校身份另行核对。");
  if (/北方|东北|华北/.test(text)) notes.push("已记录地域偏好；当前目录缺少完整办学地区字段，地域暂不参与自动筛选。");
  if (/分|位次|排名|历史类|物理类|选科/.test(text)) notes.push("文字中的成绩、位次和选科不会自动覆盖考生档案，请在上方档案中修改。");
  if (/军校|警校|公安|司法|艺术|体育|港校|香港|中外合作/.test(text)) notes.push("特殊招生需要独立核对资格，请使用“特殊招生”中心。");
  if (!needs.majors.length && !needs.excludedMajors.length && needs.region === "不限" && needs.schoolType === "不限" && !needs.maxTuition) notes.push("未提取到支持的筛选条件，请在下方手动补充。");
  return { needs, notes };
}

export type CatalogFilter = { schoolQuery: string; subject: string; batch: string; maxTuition: string };
export function parseCatalogFilter(text: string, schools: AdmissionsSchoolSummary[], subject: string): CatalogFilter {
  const mentioned = schools.filter((school) => text.includes(school.name)).sort((a, b) => b.name.length - a.name.length);
  const batch = /本科提前批\s*[AaＡ]/.test(text) ? "本科提前批A段" : /本科提前批\s*[BbＢ]/.test(text) ? "本科提前批B段" : /专科提前/.test(text) ? "高职（专科）提前批" : /本科(?!提前)/.test(text) ? "本科批" : /专科/.test(text) ? "高职（专科）批" : "";
  return { schoolQuery: mentioned[0]?.name ?? "", subject, batch, maxTuition: parseNeeds(text).needs.maxTuition };
}
export function matchesCatalog(school: AdmissionsSchoolSummary, filters: CatalogFilter): boolean {
  if (filters.schoolQuery.trim() && !`${school.name} ${school.code}`.toLocaleLowerCase("zh-CN").includes(filters.schoolQuery.trim().toLocaleLowerCase("zh-CN"))) return false;
  if (filters.subject && !school.subjects.includes(filters.subject)) return false;
  if (filters.batch && !school.batches.includes(filters.batch)) return false;
  if (filters.maxTuition && (school.tuitionMin === null || school.tuitionMin > Number(filters.maxTuition))) return false;
  return true;
}
