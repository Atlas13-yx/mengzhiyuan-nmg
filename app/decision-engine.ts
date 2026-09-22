import type { SchoolGroup, RiskLevel } from "./platform-data.ts";
import { lookupRank, type ExamTrack } from "./score-ranks.ts";

export type DecisionProfile = {
  firstSubject: ExamTrack;
  score: string;
  targetSchool: string;
  preferredRegion: string;
  preferredMajor: string;
  schoolType: string;
  tuition: string;
};

function annualTuition(group: SchoolGroup) {
  const match = group.tuition.replaceAll(",", "").match(/\d+/);
  return match ? Number(match[0]) : Number.POSITIVE_INFINITY;
}

function hasMajor(group: SchoolGroup, pattern: RegExp) {
  return group.majors.some((major) => pattern.test(major));
}

export function calculateRisk(group: SchoolGroup, profile: DecisionProfile): RiskLevel {
  const rank = lookupRank(profile.firstSubject, Number(profile.score));
  if (!rank) return group.risk;
  if (rank.rank < group.rankLow) return "保";
  if (rank.rank <= group.rankHigh) return "稳";
  return "冲";
}

export function calculateFit(
  group: SchoolGroup,
  profile: DecisionProfile,
  tags: readonly string[] = []
) {
  let score = 58;
  const risk = calculateRisk(group, profile);
  const preferenceText = `${profile.preferredMajor} ${tags.join(" ")}`;

  if (profile.targetSchool && group.school.includes(profile.targetSchool.trim())) score += 18;
  if (/计算机|软件|人工智能|数据/.test(preferenceText) && hasMajor(group, /计算机|软件|人工智能|数据/)) score += 14;
  if (/电子|通信|自动化/.test(preferenceText) && hasMajor(group, /电子|通信|自动化|计算机|人工智能/)) score += 12;
  if (/医学|临床|动物医学/.test(preferenceText) && hasMajor(group, /医学|临床|动物医学/)) score += 12;
  if (/农林|食品|生物/.test(preferenceText) && hasMajor(group, /农|林|食品|生物|动物/)) score += 10;
  if (profile.preferredRegion.includes("内蒙古") && group.province === "内蒙古") score += 9;
  if (profile.preferredRegion.includes("北方") || tags.includes("北方地区")) score += 5;
  if (profile.schoolType.includes("公办") && group.type === "公办") score += 7;
  if (profile.schoolType.includes("双一流") && group.tags.includes("双一流")) score += 8;
  if ((profile.tuition.includes("1 万") || tags.includes("学费优先")) && annualTuition(group) <= 10_000) score += 7;
  if (profile.tuition.includes("6 千") && annualTuition(group) <= 6_000) score += 7;
  if (tags.includes("公办优先") && group.type === "公办") score += 5;
  score += risk === "保" ? 6 : risk === "稳" ? 4 : 1;
  score += Math.min(5, Math.max(0, Math.round(Math.log10(group.plan + 1) * 2) - 2));

  return Math.max(55, Math.min(98, score));
}
